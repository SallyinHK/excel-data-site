import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenariosTable,
  financialInputsTable,
  calculationsTable,
  auditLogTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

const WACC = 0.085;

type SheetYear = {
  year: number;
  revenue: number;
  cogs: number;
  opex: number;
  capex: number;
};

type SheetProject = {
  projectName: string;
  region: string;
  category?: string;
  status?: string;
  investmentSize?: number;
  scenarioName?: string;
  years: SheetYear[];
};

function getBridgeConfig() {
  const bridgeUrl = process.env.SHEETS_BRIDGE_URL;
  const bridgeSecret = process.env.SHEETS_BRIDGE_SECRET;

  if (!bridgeUrl || !bridgeSecret) {
    throw new Error("SHEETS_BRIDGE_URL and SHEETS_BRIDGE_SECRET must be set.");
  }

  return { bridgeUrl, bridgeSecret };
}

async function readJson(response: globalThis.Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function money(value: unknown) {
  return String(n(value).toFixed(2));
}

function normalizeStatus(value: unknown) {
  const s = String(value || "draft").trim().toLowerCase();

  if (["approved", "approve"].includes(s)) return "approved";
  if (["review", "in review", "finance review", "management review"].includes(s)) return "review";
  if (["rejected", "reject"].includes(s)) return "rejected";
  if (["archived", "archive"].includes(s)) return "archived";

  return "draft";
}

function taxRateForRegion(region: string) {
  const key = String(region || "").trim().toUpperCase();

  if (key === "EU") return 0.22;
  if (key === "LATAM") return 0.25;
  if (key === "MEA") return 0.15;
  if (key === "NA") return 0.21;
  return 0.2;
}

function npvFromCashFlows(cashFlows: number[], discountRate = WACC) {
  return cashFlows.reduce((sum, cf, index) => {
    const year = index + 1;
    return sum + cf / Math.pow(1 + discountRate, year);
  }, 0);
}

function irrFromCashFlows(cashFlows: number[]) {
  const f = (rate: number) =>
    cashFlows.reduce((sum, cf, index) => {
      const year = index + 1;
      return sum + cf / Math.pow(1 + rate, year);
    }, 0);

  let low = -0.99;
  let high = 10;
  let lowVal = f(low);
  let highVal = f(high);

  if (Math.sign(lowVal) === Math.sign(highVal)) {
    return 0;
  }

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const midVal = f(mid);

    if (Math.abs(midVal) < 0.0001) return mid;

    if (Math.sign(midVal) === Math.sign(lowVal)) {
      low = mid;
      lowVal = midVal;
    } else {
      high = mid;
      highVal = midVal;
    }
  }

  return (low + high) / 2;
}

function paybackFromCashFlows(cashFlows: number[]) {
  let cumulative = 0;

  for (let i = 0; i < cashFlows.length; i += 1) {
    const previous = cumulative;
    cumulative += cashFlows[i];

    if (cumulative >= 0) {
      if (cashFlows[i] === 0) return i + 1;
      const fraction = Math.max(0, Math.min(1, -previous / cashFlows[i]));
      return i + fraction;
    }
  }

  return 0;
}

function profitabilityIndex(cashFlows: number[], discountRate = WACC) {
  let pvPositive = 0;
  let pvNegative = 0;

  cashFlows.forEach((cf, index) => {
    const year = index + 1;
    const pv = cf / Math.pow(1 + discountRate, year);

    if (pv >= 0) {
      pvPositive += pv;
    } else {
      pvNegative += Math.abs(pv);
    }
  });

  if (pvNegative === 0) return 0;

  return pvPositive / pvNegative;
}

function calculateProject(years: SheetYear[], region: string) {
  const taxRate = taxRateForRegion(region);

  const rows = years
    .map((row) => {
      const revenue = n(row.revenue);
      const cogs = n(row.cogs);
      const opex = n(row.opex);
      const capex = n(row.capex);

      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - opex;
      const taxExpense = Math.max(0, ebitda * taxRate);
      const nopat = ebitda - taxExpense;
      const fcf = nopat - capex;

      return {
        year: n(row.year),
        revenue,
        cogs,
        opex,
        capex,
        grossProfit,
        ebitda,
        taxExpense,
        nopat,
        fcf,
      };
    })
    .filter((row) => row.year > 0)
    .sort((a, b) => a.year - b.year);

  const cashFlows = rows.map((row) => row.fcf);

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cogs + row.opex, 0);
  const totalCapex = rows.reduce((sum, row) => sum + row.capex, 0);
  const totalFcf = rows.reduce((sum, row) => sum + row.fcf, 0);

  const npv = npvFromCashFlows(cashFlows);
  const irr = irrFromCashFlows(cashFlows);
  const paybackPeriod = paybackFromCashFlows(cashFlows);
  const roi = totalCapex > 0 ? totalFcf / totalCapex : 0;
  const pi = profitabilityIndex(cashFlows);

  return {
    rows,
    totalRevenue,
    totalCost,
    totalCapex,
    totalFcf,
    npv,
    irr,
    paybackPeriod,
    roi,
    pi,
  };
}

async function upsertProjectFromSheet(item: SheetProject) {
  const P = projectsTable as any;
  const S = scenariosTable as any;
  const F = financialInputsTable as any;
  const C = calculationsTable as any;
  const A = auditLogTable as any;

  const projectName = String(item.projectName || "").trim();
  const region = String(item.region || "").trim();
  const scenarioName = String(item.scenarioName || "Baseline").trim();

  if (!projectName || !region) {
    return { skipped: true, reason: "Missing project name or region" };
  }

  const years = Array.isArray(item.years)
    ? item.years.filter((row) => n(row.year) > 0)
    : [];

  if (years.length === 0) {
    return { skipped: true, reason: `No yearly input rows for ${projectName}` };
  }

  const [existingProject] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(P.name, projectName), eq(P.region, region)));

  let project = existingProject as any;
  const projectValues = {
    name: projectName,
    description: "Imported from Google Sheet Input tab.",
    region,
    productCategory: item.category || null,
    investmentSize: money(item.investmentSize || years.reduce((sum, row) => sum + n(row.capex), 0)),
    status: normalizeStatus(item.status),
    createdBy: "google-sheet-import",
  };

  if (!project) {
    [project] = await db
      .insert(projectsTable)
      .values(projectValues)
      .returning();
  } else {
    [project] = await db
      .update(projectsTable)
      .set({
        description: projectValues.description,
        productCategory: projectValues.productCategory,
        investmentSize: projectValues.investmentSize,
        status: projectValues.status,
      })
      .where(eq(P.id, project.id))
      .returning();
  }

  let [scenario] = await db
    .select()
    .from(scenariosTable)
    .where(and(eq(S.projectId, project.id), eq(S.name, scenarioName)));

  if (!scenario) {
    [scenario] = await db
      .insert(scenariosTable)
      .values({
        projectId: project.id,
        name: scenarioName,
        isBaseline: scenarioName.toLowerCase() === "baseline",
        lifecycleYears: years.length,
        assumptionsSummary: "Imported from Google Sheet Input tab.",
      })
      .returning();
  } else {
    [scenario] = await db
      .update(scenariosTable)
      .set({
        lifecycleYears: years.length,
        assumptionsSummary: "Imported from Google Sheet Input tab.",
      })
      .where(eq(S.id, (scenario as any).id))
      .returning();
  }

  const existingInputs = await db
    .select()
    .from(financialInputsTable)
    .where(eq(F.scenarioId, (scenario as any).id));

  await db.delete(calculationsTable).where(eq(C.scenarioId, (scenario as any).id));
  await db.delete(financialInputsTable).where(eq(F.scenarioId, (scenario as any).id));

  await db.insert(financialInputsTable).values(
    years.map((row) => ({
      scenarioId: (scenario as any).id,
      year: n(row.year),
      revenue: money(row.revenue),
      cogs: money(row.cogs),
      opex: money(row.opex),
      capex: money(row.capex),
    }))
  );

  const calc = calculateProject(years, region);

  await db.insert(calculationsTable).values({
    scenarioId: (scenario as any).id,
    npv: money(calc.npv),
    irr: String(calc.irr.toFixed(6)),
    paybackPeriod: String(calc.paybackPeriod.toFixed(4)),
    roi: String(calc.roi.toFixed(6)),
    profitabilityIndex: String(calc.pi.toFixed(6)),
    totalRevenue: money(calc.totalRevenue),
    totalCost: money(calc.totalCost),
    totalCapex: money(calc.totalCapex),
    totalFcf: money(calc.totalFcf),
  });

  await db.insert(auditLogTable).values([
    {
      tableName: "projects",
      recordId: project.id,
      fieldName: "sheets_import",
      oldValue: existingProject ? "Existing project updated" : "New project created",
      newValue: `Imported ${years.length} year(s) from Google Sheet`,
      changedBy: "google-sheet-import",
    },
    {
      tableName: "financial_inputs",
      recordId: project.id,
      fieldName: "inputs_bulk_update",
      oldValue: `${existingInputs.length} input row(s) replaced`,
      newValue: `${years.length} input row(s) imported`,
      changedBy: "google-sheet-import",
    },
    {
      tableName: "calculations",
      recordId: project.id,
      fieldName: "calculation_run",
      oldValue: "—",
      newValue: `NPV: ${calc.npv.toFixed(2)}, IRR: ${calc.irr.toFixed(4)}`,
      changedBy: "google-sheet-import",
    },
  ]);

  return {
    skipped: false,
    projectId: project.id,
    projectName,
    region,
    scenarioName,
    yearCount: years.length,
    npv: calc.npv,
    irr: calc.irr,
  };
}

router.post("/import", async (_req, res) => {
  try {
    const { bridgeUrl, bridgeSecret } = getBridgeConfig();

    const url = new URL(bridgeUrl);
    url.searchParams.set("action", "import");
    url.searchParams.set("secret", bridgeSecret);

    const bridgeResponse = await fetch(url.toString());
    const bridgeJson = await readJson(bridgeResponse);

    if (!bridgeResponse.ok || bridgeJson.ok === false) {
      return res.status(502).json({
        ok: false,
        error: bridgeJson.error || "Failed to read Google Sheet.",
      });
    }

    const sheetProjects: SheetProject[] = bridgeJson.data?.projects || [];
    const results = [];

    for (const project of sheetProjects) {
      results.push(await upsertProjectFromSheet(project));
    }

    const imported = results.filter((item: any) => !item.skipped);
    const skipped = results.filter((item: any) => item.skipped);

    return res.json({
      ok: true,
      mode: "upsert",
      projectCount: imported.length,
      skippedCount: skipped.length,
      message: `Imported ${imported.length} project(s) from Google Sheet into Supabase.`,
      imported,
      skipped,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Google Sheet import failed.",
    });
  }
});

router.post("/export", async (req, res) => {
  try {
    const { bridgeUrl, bridgeSecret } = getBridgeConfig();

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/projects`);
    const dashboardJson = await readJson(dashboardResponse);

    if (!dashboardResponse.ok) {
      return res.status(502).json({
        ok: false,
        error: "Failed to read platform project data.",
      });
    }

    const projects = Array.isArray(dashboardJson)
      ? dashboardJson
      : dashboardJson.projects || dashboardJson.data || [];

    const bridgeResponse = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "export",
        secret: bridgeSecret,
        projects,
      }),
    });

    const bridgeJson = await readJson(bridgeResponse);

    if (!bridgeResponse.ok || bridgeJson.ok === false) {
      return res.status(502).json({
        ok: false,
        error: bridgeJson.error || "Failed to export to Google Sheet.",
      });
    }

    return res.json({
      ok: true,
      projectCount: projects.length,
      message: `Exported ${projects.length} project record(s) to Google Sheet Output tab.`,
      data: bridgeJson.data,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Google Sheet export failed.",
    });
  }
});

export default router;
