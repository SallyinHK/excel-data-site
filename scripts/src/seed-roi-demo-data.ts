import { db, pool } from "@workspace/db";
import {
  projectsTable,
  scenariosTable,
  financialInputsTable,
  calculationsTable,
  formulaDefinitionsTable,
  regionalParametersTable,
  auditLogTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

type YearInput = {
  year: number;
  revenue: number;
  cogs: number;
  opex: number;
  capex: number;
};

type DemoProject = {
  name: string;
  region: string;
  category: string;
  investment: number;
  status: string;
  scenario: string;
  years: YearInput[];
};

type CashFlow = {
  year: number;
  revenue: number;
  grossProfit: number;
  ebitda: number;
  nopat: number;
  freeCashFlow: number;
  cumulativeCashFlow: number;
};

function calculateROI(inputs: YearInput[], wacc: number, taxRate: number) {
  let cumulativeCashFlow = 0;
  let totalCapex = 0;

  const cashFlows: CashFlow[] = inputs.map((input) => {
    const grossProfit = input.revenue - input.cogs;
    const ebitda = grossProfit - input.opex;
    const tax = ebitda > 0 ? ebitda * taxRate : 0;
    const nopat = ebitda - tax;
    const freeCashFlow = nopat - input.capex;

    totalCapex += input.capex;
    cumulativeCashFlow += freeCashFlow;

    return {
      year: input.year,
      revenue: input.revenue,
      grossProfit,
      ebitda,
      nopat,
      freeCashFlow,
      cumulativeCashFlow,
    };
  });

  const totalRevenue = cashFlows.reduce((s, cf) => s + cf.revenue, 0);
  const totalCogs = inputs.reduce((s, i) => s + i.cogs, 0);
  const totalCost = inputs.reduce((s, i) => s + i.cogs + i.opex, 0);
  const totalFCF = cashFlows.reduce((s, cf) => s + cf.freeCashFlow, 0);

  const npv = cashFlows.reduce((s, cf, index) => {
    return s + cf.freeCashFlow / Math.pow(1 + wacc, index);
  }, 0);

  const paybackPeriod = (() => {
    for (let i = 0; i < cashFlows.length; i++) {
      if (cashFlows[i].cumulativeCashFlow >= 0) {
        if (i === 0) return 0;
        const prev = cashFlows[i - 1].cumulativeCashFlow;
        const curr = cashFlows[i].cumulativeCashFlow;
        return (i - 1) + (-prev) / (curr - prev);
      }
    }
    return null;
  })();

  const irr = (() => {
    const flows = cashFlows.map((cf) => cf.freeCashFlow);
    if (!flows.some((v) => v < 0) || !flows.some((v) => v > 0)) return null;

    let low = -0.99;
    let high = 10;

    for (let i = 0; i < 200; i++) {
      const mid = (low + high) / 2;
      const value = flows.reduce((s, cf, t) => s + cf / Math.pow(1 + mid, t), 0);
      const lowValue = flows.reduce((s, cf, t) => s + cf / Math.pow(1 + low, t), 0);

      if (Math.abs(value) < 0.000001) return mid;

      if (value * lowValue < 0) {
        high = mid;
      } else {
        low = mid;
      }
    }

    return (low + high) / 2;
  })();

  return {
    npv,
    irr,
    paybackPeriod,
    roiPercent: totalCapex > 0 ? (totalFCF / totalCapex) * 100 : null,
    totalRevenue,
    totalCost,
    totalCogs,
    totalCapex,
    cashFlows,
  };
}

const regions = [
  { region: "APAC", taxRate: "0.2000", currency: "USD", exchangeRateToUsd: "1.000000", effectiveDate: "2026-05-17" },
  { region: "EU", taxRate: "0.2200", currency: "EUR", exchangeRateToUsd: "1.080000", effectiveDate: "2026-05-17" },
  { region: "NA", taxRate: "0.2100", currency: "USD", exchangeRateToUsd: "1.000000", effectiveDate: "2026-05-17" },
  { region: "LATAM", taxRate: "0.2500", currency: "USD", exchangeRateToUsd: "1.000000", effectiveDate: "2026-05-17" },
  { region: "MEA", taxRate: "0.1500", currency: "USD", exchangeRateToUsd: "1.000000", effectiveDate: "2026-05-17" },
];

const data: DemoProject[] = [
  {
    name: "NextGen Fiber Optics — APAC Rollout",
    region: "APAC",
    category: "Infrastructure",
    investment: 45000000,
    status: "approved",
    scenario: "Baseline",
    years: [
      { year: 1, revenue: 10200000, cogs: 4800000, opex: 2100000, capex: 18000000 },
      { year: 2, revenue: 24640000, cogs: 9800000, opex: 3200000, capex: 12000000 },
      { year: 3, revenue: 40500000, cogs: 15000000, opex: 4500000, capex: 8000000 },
      { year: 4, revenue: 53360000, cogs: 18500000, opex: 5200000, capex: 4000000 },
      { year: 5, revenue: 63920000, cogs: 21000000, opex: 5800000, capex: 3000000 },
    ],
  },
  {
    name: "Smart Grid Modernization — EU Phase 2",
    region: "EU",
    category: "Energy",
    investment: 28500000,
    status: "review",
    scenario: "Baseline",
    years: [
      { year: 1, revenue: 9600000, cogs: 5200000, opex: 1800000, capex: 10000000 },
      { year: 2, revenue: 20000000, cogs: 9600000, opex: 2600000, capex: 7000000 },
      { year: 3, revenue: 33280000, cogs: 14500000, opex: 3400000, capex: 5000000 },
      { year: 4, revenue: 44200000, cogs: 17800000, opex: 4000000, capex: 3500000 },
      { year: 5, revenue: 52800000, cogs: 20000000, opex: 4500000, capex: 3000000 },
    ],
  },
  {
    name: "Cloud ERP Migration — NA",
    region: "NA",
    category: "Software",
    investment: 12000000,
    status: "approved",
    scenario: "Baseline",
    years: [
      { year: 1, revenue: 3000000, cogs: 1200000, opex: 1500000, capex: 4000000 },
      { year: 2, revenue: 7440000, cogs: 2400000, opex: 1800000, capex: 2000000 },
      { year: 3, revenue: 13120000, cogs: 3600000, opex: 2100000, capex: 2000000 },
      { year: 4, revenue: 18150000, cogs: 4500000, opex: 2400000, capex: 2000000 },
      { year: 5, revenue: 22950000, cogs: 5200000, opex: 2600000, capex: 2000000 },
    ],
  },
  {
    name: "Autonomous Logistics Platform — LATAM",
    region: "LATAM",
    category: "Logistics",
    investment: 18000000,
    status: "draft",
    scenario: "Baseline",
    years: [
      { year: 1, revenue: 4750000, cogs: 2800000, opex: 1200000, capex: 8000000 },
      { year: 2, revenue: 11760000, cogs: 6000000, opex: 2000000, capex: 4000000 },
      { year: 3, revenue: 22000000, cogs: 10500000, opex: 2800000, capex: 3000000 },
      { year: 4, revenue: 30600000, cogs: 13800000, opex: 3400000, capex: 2000000 },
      { year: 5, revenue: 37800000, cogs: 16200000, opex: 3800000, capex: 1000000 },
    ],
  },
  {
    name: "Renewable Energy Storage — MEA",
    region: "MEA",
    category: "Energy",
    investment: 55000000,
    status: "review",
    scenario: "Baseline",
    years: [
      { year: 1, revenue: 2400000, cogs: 1200000, opex: 800000, capex: 25000000 },
      { year: 2, revenue: 5880000, cogs: 2400000, opex: 1200000, capex: 15000000 },
      { year: 3, revenue: 9000000, cogs: 3200000, opex: 1600000, capex: 8000000 },
      { year: 4, revenue: 11000000, cogs: 3800000, opex: 1900000, capex: 5000000 },
      { year: 5, revenue: 12750000, cogs: 4200000, opex: 2100000, capex: 2000000 },
    ],
  },
  {
    name: "Digital Health Platform — NA",
    region: "NA",
    category: "Healthcare",
    investment: 9500000,
    status: "approved",
    scenario: "Baseline",
    years: [
      { year: 1, revenue: 2700000, cogs: 900000, opex: 1100000, capex: 3500000 },
      { year: 2, revenue: 7220000, cogs: 1900000, opex: 1400000, capex: 2000000 },
      { year: 3, revenue: 13000000, cogs: 2900000, opex: 1700000, capex: 2000000 },
      { year: 4, revenue: 19320000, cogs: 3800000, opex: 1900000, capex: 1000000 },
      { year: 5, revenue: 25300000, cogs: 4600000, opex: 2100000, capex: 1000000 },
    ],
  },
];

async function main() {
  for (const region of regions) {
    await db
      .insert(regionalParametersTable)
      .values(region)
      .onConflictDoUpdate({
        target: regionalParametersTable.region,
        set: {
          taxRate: region.taxRate,
          currency: region.currency,
          exchangeRateToUsd: region.exchangeRateToUsd,
          effectiveDate: region.effectiveDate,
        },
      });
  }

  const existingFormula = await db.select().from(formulaDefinitionsTable).limit(1);

  if (existingFormula.length === 0) {
    await db.insert(formulaDefinitionsTable).values({
      formulaType: "DCF_ROI",
      wacc: "0.0850",
      discountRate: "0.0850",
      parametersJson: JSON.stringify({
        source: "Seeded demo governance formula",
        notes: "Standard WACC used for demo calculations",
      }),
      locked: true,
      version: 1,
      updatedBy: "demo-seed",
    });
  }

  for (const item of data) {
    const [regional] = await db
      .select()
      .from(regionalParametersTable)
      .where(eq(regionalParametersTable.region, item.region));

    const taxRate = regional ? Number(regional.taxRate) : 0.25;
    const wacc = 0.085;

    let [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.name, item.name));

    if (!project) {
      [project] = await db
        .insert(projectsTable)
        .values({
          name: item.name,
          description: `Demo project seeded from ROI Data.xlsx for live presentation.`,
          region: item.region,
          productCategory: item.category,
          investmentSize: item.investment.toFixed(2),
          status: item.status,
          createdBy: "demo-seed",
        })
        .returning();
    } else {
      [project] = await db
        .update(projectsTable)
        .set({
          description: `Demo project seeded from ROI Data.xlsx for live presentation.`,
          region: item.region,
          productCategory: item.category,
          investmentSize: item.investment.toFixed(2),
          status: item.status,
          createdBy: project.createdBy || "demo-seed",
        })
        .where(eq(projectsTable.id, project.id))
        .returning();
    }

    let [scenario] = await db
      .select()
      .from(scenariosTable)
      .where(and(eq(scenariosTable.projectId, project.id), eq(scenariosTable.name, item.scenario)));

    if (!scenario) {
      [scenario] = await db
        .insert(scenariosTable)
        .values({
          projectId: project.id,
          name: item.scenario,
          isBaseline: "true",
          lifecycleYears: item.years.length,
          assumptionsSummary: "Seeded baseline scenario from ROI Data.xlsx",
        })
        .returning();
    } else {
      [scenario] = await db
        .update(scenariosTable)
        .set({
          isBaseline: "true",
          lifecycleYears: item.years.length,
          assumptionsSummary: "Seeded baseline scenario from ROI Data.xlsx",
        })
        .where(eq(scenariosTable.id, scenario.id))
        .returning();
    }

    await db.delete(calculationsTable).where(eq(calculationsTable.scenarioId, scenario.id));
    await db.delete(financialInputsTable).where(eq(financialInputsTable.scenarioId, scenario.id));

    await db.insert(financialInputsTable).values(
      item.years.map((row) => ({
        scenarioId: scenario.id,
        year: row.year,
        salesVolume: row.revenue.toFixed(2),
        netPrice: "1.0000",
        cogs: row.cogs.toFixed(2),
        opex: row.opex.toFixed(2),
        capex: row.capex.toFixed(2),
      }))
    );

    const result = calculateROI(item.years, wacc, taxRate);

    await db.insert(calculationsTable).values({
      scenarioId: scenario.id,
      npv: result.npv.toFixed(2),
      irr: result.irr != null ? result.irr.toFixed(6) : null,
      paybackPeriod: result.paybackPeriod != null ? result.paybackPeriod.toFixed(4) : null,
      roiPercent: result.roiPercent != null ? result.roiPercent.toFixed(4) : null,
      totalRevenue: result.totalRevenue.toFixed(2),
      totalCost: result.totalCost.toFixed(2),
      totalCogs: result.totalCogs.toFixed(2),
      totalCapex: result.totalCapex.toFixed(2),
      cashFlows: JSON.stringify(result.cashFlows),
    });

    await db.insert(auditLogTable).values({
      tableName: "projects",
      recordId: project.id,
      fieldName: "demo_seed",
      oldValue: null,
      newValue: `Seeded ${item.name}`,
      changedBy: "demo-seed",
    });

    console.log(`Seeded: ${item.name}`);
  }

  console.log("Demo ROI data seeded successfully.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
