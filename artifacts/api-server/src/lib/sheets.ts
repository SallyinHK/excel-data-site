/**
 * Google Sheets sync helper — uses @replit/connectors-sdk
 * Integration: Google Sheets (connector:ccfg_google-sheet_E42A9F6CA62546F68A1FECA0E8)
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenariosTable,
  financialInputsTable,
  calculationsTable,
  formulaDefinitionsTable,
  regionalParametersTable,
  auditLogTable,
} from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";
import { calculateROI } from "./calculations";
import { logger } from "./logger";

const SHEET_ID = "1kysyHbkIsz_G5GbJEnbiuF6Qb4n2VduqsicjIsFP3gs";
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

const INPUT_HEADERS = [
  "Project Name",
  "Region",
  "Category",
  "Investment ($)",
  "Scenario",
  "Year",
  "Revenue ($)",
  "COGS ($)",
  "OPEX ($)",
  "CapEx ($)",
  "Status",
];

const OUTPUT_HEADERS = [
  "Project Name",
  "Region",
  "Category",
  "Investment ($)",
  "Status",
  "Scenario",
  "NPV ($)",
  "IRR (%)",
  "Payback Period (y)",
  "ROI (%)",
  "Total Revenue ($)",
  "Total Cost ($)",
  "Total CapEx ($)",
  "Last Synced (HKT)",
];

async function sheetsRequest(
  path: string,
  method = "GET",
  body?: unknown
): Promise<unknown> {
  const connectors = new ReplitConnectors();
  const opts: { method: string; headers?: Record<string, string>; body?: string } = { method };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const resp = await connectors.proxy("google-sheet", path, opts);
  return resp.json();
}

/** Push all DB inputs and calculation results to the spreadsheet. */
export async function exportToSheets(): Promise<{
  inputRows: number;
  outputRows: number;
}> {
  const projects = await db
    .select()
    .from(projectsTable)
    .where(ne(projectsTable.status, "archived"));

  const inputRows: (string | number)[][] = [INPUT_HEADERS];
  const outputRows: (string | number)[][] = [OUTPUT_HEADERS];
  const now = new Date().toLocaleString("en-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (const project of projects) {
    const scenarios = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.projectId, project.id))
      .orderBy(scenariosTable.id);

    for (const scenario of scenarios) {
      const inputs = await db
        .select()
        .from(financialInputsTable)
        .where(eq(financialInputsTable.scenarioId, scenario.id))
        .orderBy(financialInputsTable.year);

      const [calc] = await db
        .select()
        .from(calculationsTable)
        .where(eq(calculationsTable.scenarioId, scenario.id))
        .orderBy(desc(calculationsTable.calculatedAt))
        .limit(1);

      for (const inp of inputs) {
        const revenue = parseFloat(inp.salesVolume) * parseFloat(inp.netPrice);
        inputRows.push([
          project.name,
          project.region,
          project.productCategory ?? "",
          project.investmentSize ? parseFloat(project.investmentSize) : "",
          scenario.name,
          inp.year,
          +revenue.toFixed(2),
          +parseFloat(inp.cogs).toFixed(2),
          +parseFloat(inp.opex).toFixed(2),
          +parseFloat(inp.capex).toFixed(2),
          project.status,
        ]);
      }

      if (calc) {
        outputRows.push([
          project.name,
          project.region,
          project.productCategory ?? "",
          project.investmentSize ? parseFloat(project.investmentSize) : "",
          project.status,
          scenario.name,
          +parseFloat(calc.npv).toFixed(2),
          calc.irr != null ? +(parseFloat(calc.irr) * 100).toFixed(2) : "",
          calc.paybackPeriod != null
            ? +parseFloat(calc.paybackPeriod).toFixed(2)
            : "",
          calc.roiPercent != null
            ? +parseFloat(calc.roiPercent).toFixed(2)
            : "",
          calc.totalRevenue != null
            ? +parseFloat(calc.totalRevenue).toFixed(2)
            : "",
          calc.totalCost != null ? +parseFloat(calc.totalCost).toFixed(2) : "",
          calc.totalCapex != null
            ? +parseFloat(calc.totalCapex).toFixed(2)
            : "",
          now,
        ]);
      }
    }
  }

  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Input!A1:K1000:clear`,
    "POST"
  );
  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Input!A1:K${inputRows.length}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: inputRows }
  );

  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Output!A1:N1000:clear`,
    "POST"
  );
  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Output!A1:N${outputRows.length}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: outputRows }
  );

  logger.info(
    { inputRows: inputRows.length - 1, outputRows: outputRows.length - 1 },
    "Exported to Google Sheets"
  );
  return { inputRows: inputRows.length - 1, outputRows: outputRows.length - 1 };
}

/** Retry a DB operation on transient connection errors with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4
): Promise<T> {
  const TRANSIENT = [
    "terminating connection",
    "connection terminated",
    "connection timeout",
    "connection lost",
    "client was closed",
    "the database system is",
  ];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isTransient = TRANSIENT.some((t) => msg.includes(t));
      if (isTransient && attempt < maxAttempts) {
        const delay = 500 * 2 ** (attempt - 1); // 500ms, 1s, 2s
        logger.warn({ attempt, delay, label }, "Transient DB error — retrying");
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  /* istanbul ignore next */
  throw new Error("withRetry: unreachable");
}

/** Read the Input sheet and upsert financial data, then recalculate every touched scenario. */
export async function importFromSheets(): Promise<{
  updated: number;
  calculated: number;
  errors: string[];
}> {
  const raw = (await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Input!A1:J1000`
  )) as { values?: string[][] };
  const rows: string[][] = raw.values ?? [];

  if (rows.length <= 1) {
    return { updated: 0, calculated: 0, errors: [] };
  }

  const dataRows = rows
    .slice(1)
    .filter((r) => r.length >= 10 && r[0]?.trim() && r[4]?.trim() && r[5]?.trim());

  type YearEntry = {
    year: number;
    revenue: number;
    cogs: number;
    opex: number;
    capex: number;
  };
  type ScenarioMap = Map<string, YearEntry[]>;
  type ProjectEntry = {
    region: string;
    category: string;
    investment: string;
    scenarios: ScenarioMap;
  };

  const projectMap = new Map<string, ProjectEntry>();

  for (const row of dataRows) {
    const [
      projectName,
      region,
      category,
      investment,
      scenarioName,
      yearStr,
      revenueStr,
      cogsStr,
      opexStr,
      capexStr,
    ] = row.map((v) => v?.trim() ?? "");

    const year = parseInt(yearStr);
    if (isNaN(year) || year < 1) continue;

    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, { region, category, investment, scenarios: new Map() });
    }
    const pd = projectMap.get(projectName)!;
    if (!pd.scenarios.has(scenarioName)) pd.scenarios.set(scenarioName, []);
    pd.scenarios.get(scenarioName)!.push({
      year,
      revenue: parseFloat(revenueStr) || 0,
      cogs: parseFloat(cogsStr) || 0,
      opex: parseFloat(opexStr) || 0,
      capex: parseFloat(capexStr) || 0,
    });
  }

  // Fetch governance config once (outside the per-project loop)
  const [formula] = await withRetry(
    () => db.select().from(formulaDefinitionsTable).orderBy(desc(formulaDefinitionsTable.version)).limit(1),
    "fetch formula"
  );
  const defaultWacc = formula ? parseFloat(formula.wacc) : 0.1;

  const errors: string[] = [];
  let updated = 0;
  let calculated = 0;

  for (const [projectName, pd] of projectMap) {
    try {
      // Resolve or create project
      const existingProjects = await withRetry(
        () => db.select().from(projectsTable).where(eq(projectsTable.name, projectName)),
        `find project "${projectName}"`
      );
      let project = existingProjects.find((p) => p.status !== "archived") ?? existingProjects[0];

      if (!project) {
        const inv = pd.investment ? parseFloat(pd.investment) : null;
        [project] = await withRetry(
          () =>
            db
              .insert(projectsTable)
              .values({
                name: projectName,
                region: pd.region || "NA",
                productCategory: pd.category || null,
                investmentSize: inv != null ? String(inv) : null,
                status: "draft",
                createdBy: "sheets-import",
                description: "Imported from Google Sheets",
              })
              .returning(),
          `create project "${projectName}"`
        );
      }

      const [regional] = await withRetry(
        () => db.select().from(regionalParametersTable).where(eq(regionalParametersTable.region, project.region)),
        `fetch regional "${project.region}"`
      );
      const taxRate = regional ? parseFloat(regional.taxRate) : 0.25;

      for (const [scenarioName, yearInputs] of pd.scenarios) {
        const label = `"${scenarioName}" in "${projectName}"`;
        try {
          // All writes for this scenario run inside one transaction with retry
          await withRetry(async () => {
            await db.transaction(async (tx) => {
              // Resolve or create scenario
              const allScenarios = await tx
                .select()
                .from(scenariosTable)
                .where(eq(scenariosTable.projectId, project.id));
              let scenario =
                allScenarios.find((s) => s.name.toLowerCase() === scenarioName.toLowerCase()) ?? null;

              if (!scenario) {
                [scenario] = await tx
                  .insert(scenariosTable)
                  .values({
                    projectId: project.id,
                    name: scenarioName,
                    lifecycleYears: Math.max(...yearInputs.map((y) => y.year)),
                    isBaseline: allScenarios.length === 0 ? "true" : "false",
                    assumptionsSummary: "Imported from Google Sheets",
                  })
                  .returning();
              }

              // Upsert financial inputs
              const existingInputs = await tx
                .select()
                .from(financialInputsTable)
                .where(eq(financialInputsTable.scenarioId, scenario.id));

              for (const yd of yearInputs) {
                const existing = existingInputs.find((r) => r.year === yd.year);
                const vals = {
                  salesVolume: yd.revenue.toFixed(2),
                  netPrice: "1",
                  cogs: yd.cogs.toFixed(2),
                  opex: yd.opex.toFixed(2),
                  capex: yd.capex.toFixed(2),
                };
                if (existing) {
                  await tx
                    .update(financialInputsTable)
                    .set(vals)
                    .where(
                      and(
                        eq(financialInputsTable.scenarioId, scenario.id),
                        eq(financialInputsTable.year, yd.year)
                      )
                    );
                } else {
                  await tx
                    .insert(financialInputsTable)
                    .values({ scenarioId: scenario.id, year: yd.year, ...vals });
                }
              }

              // Re-read all inputs to calculate
              const allInputs = await tx
                .select()
                .from(financialInputsTable)
                .where(eq(financialInputsTable.scenarioId, scenario.id))
                .orderBy(financialInputsTable.year);

              if (allInputs.length > 0) {
                const mapped = allInputs.map((i) => ({
                  year: i.year,
                  salesVolume: parseFloat(i.salesVolume),
                  netPrice: parseFloat(i.netPrice),
                  cogs: parseFloat(i.cogs),
                  opex: parseFloat(i.opex),
                  capex: parseFloat(i.capex),
                }));
                const result = calculateROI(mapped, defaultWacc, taxRate);

                await tx.delete(calculationsTable).where(eq(calculationsTable.scenarioId, scenario.id));
                await tx.insert(calculationsTable).values({
                  scenarioId: scenario.id,
                  npv: result.npv.toFixed(2),
                  irr: result.irr != null ? result.irr.toFixed(6) : null,
                  paybackPeriod: result.paybackPeriod != null ? result.paybackPeriod.toFixed(4) : null,
                  roiPercent: result.roiPercent != null ? result.roiPercent.toFixed(4) : null,
                  totalRevenue: result.totalRevenue.toFixed(2),
                  totalCost: result.totalCost.toFixed(2),
                  totalCapex: result.totalCapex.toFixed(2),
                  cashFlows: JSON.stringify(result.cashFlows),
                });
                await tx.insert(auditLogTable).values({
                  tableName: "calculations",
                  recordId: project.id,
                  fieldName: "sheets_import",
                  oldValue: null,
                  newValue: `NPV: ${result.npv.toFixed(2)}`,
                  changedBy: "sheets-import",
                });
              }
            });
          }, label);

          updated++;
          calculated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
          errors.push(`Scenario ${label}: ${msg}`);
          logger.error({ err }, "Sheets import: scenario error");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
      errors.push(`Project "${projectName}": ${msg}`);
      logger.error({ err }, "Sheets import: project error");
    }
  }

  logger.info({ updated, calculated, errors: errors.length }, "Imported from Google Sheets");
  return { updated, calculated, errors };
}
