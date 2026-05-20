import { Router } from "express";
import { db } from "@workspace/db";
import {
  scenariosTable,
  financialInputsTable,
  calculationsTable,
  formulaDefinitionsTable,
  regionalParametersTable,
  auditLogTable,
  projectsTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateScenarioBody,
  UpdateScenarioBody,
  DuplicateScenarioBody,
  SaveFinancialInputsBody,
} from "@workspace/api-zod";
import { calculateROI } from "../lib/calculations";

const router = Router();

async function getLatestCalc(scenarioId: number) {
  const [calc] = await db
    .select()
    .from(calculationsTable)
    .where(eq(calculationsTable.scenarioId, scenarioId))
    .orderBy(desc(calculationsTable.calculatedAt))
    .limit(1);
  return calc ?? null;
}

function formatCalc(calc: typeof calculationsTable.$inferSelect | null) {
  if (!calc) return null;
  return {
    ...calc,
    npv: parseFloat(calc.npv),
    irr: calc.irr != null ? parseFloat(calc.irr) : null,
    paybackPeriod: calc.paybackPeriod != null ? parseFloat(calc.paybackPeriod) : null,
    roiPercent: calc.roiPercent != null ? parseFloat(calc.roiPercent) : null,
    totalRevenue: calc.totalRevenue != null ? parseFloat(calc.totalRevenue) : null,
    totalCost: calc.totalCost != null ? parseFloat(calc.totalCost) : null,
    totalCogs: calc.totalCogs != null ? parseFloat(calc.totalCogs) : null,
    totalCapex: calc.totalCapex != null ? parseFloat(calc.totalCapex) : null,
  };
}

// GET /api/projects/:id/scenarios
router.get("/projects/:id/scenarios", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const scenarios = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.projectId, projectId))
      .orderBy(scenariosTable.id);

    const withCalcs = await Promise.all(
      scenarios.map(async (s) => {
        const calc = await getLatestCalc(s.id);
        return { ...s, isBaseline: s.isBaseline === "true", calculation: formatCalc(calc) };
      })
    );
    return res.json(withCalcs);
  } catch (err) {
    req.log.error({ err }, "Failed to list scenarios");
    return res.status(500).json({ error: "Failed to list scenarios" });
  }
});

// POST /api/projects/:id/scenarios
router.post("/projects/:id/scenarios", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const parsed = CreateScenarioBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { name, lifecycleYears, assumptionsSummary, isBaseline } = parsed.data;
    const [scenario] = await db
      .insert(scenariosTable)
      .values({
        projectId,
        name,
        lifecycleYears: lifecycleYears ?? 5,
        assumptionsSummary: assumptionsSummary ?? null,
        isBaseline: isBaseline ? "true" : "false",
      })
      .returning();
    return res.status(201).json({ ...scenario, isBaseline: scenario.isBaseline === "true", calculation: null });
  } catch (err) {
    req.log.error({ err }, "Failed to create scenario");
    return res.status(500).json({ error: "Failed to create scenario" });
  }
});

// GET /api/scenarios/:id
router.get("/scenarios/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [scenario] = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.id, id));
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });
    const calc = await getLatestCalc(id);
    return res.json({ ...scenario, isBaseline: scenario.isBaseline === "true", calculation: formatCalc(calc) });
  } catch (err) {
    req.log.error({ err }, "Failed to get scenario");
    return res.status(500).json({ error: "Failed to get scenario" });
  }
});

// PATCH /api/scenarios/:id
router.patch("/scenarios/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateScenarioBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { name, lifecycleYears, assumptionsSummary, isBaseline } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (lifecycleYears !== undefined) updateData.lifecycleYears = lifecycleYears;
    if (assumptionsSummary !== undefined) updateData.assumptionsSummary = assumptionsSummary;
    if (isBaseline !== undefined) updateData.isBaseline = isBaseline ? "true" : "false";

    const [updated] = await db
      .update(scenariosTable)
      .set(updateData)
      .where(eq(scenariosTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Scenario not found" });
    const calc = await getLatestCalc(id);
    return res.json({ ...updated, isBaseline: updated.isBaseline === "true", calculation: formatCalc(calc) });
  } catch (err) {
    req.log.error({ err }, "Failed to update scenario");
    return res.status(500).json({ error: "Failed to update scenario" });
  }
});

// POST /api/scenarios/:id/duplicate
router.post("/scenarios/:id/duplicate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = DuplicateScenarioBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const [original] = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.id, id));
    if (!original) return res.status(404).json({ error: "Scenario not found" });

    const [newScenario] = await db
      .insert(scenariosTable)
      .values({
        projectId: original.projectId,
        name: parsed.data.name,
        lifecycleYears: original.lifecycleYears,
        assumptionsSummary: original.assumptionsSummary,
        isBaseline: "false",
      })
      .returning();

    const inputs = await db
      .select()
      .from(financialInputsTable)
      .where(eq(financialInputsTable.scenarioId, id));

    if (inputs.length > 0) {
      await db.insert(financialInputsTable).values(
        inputs.map((inp) => ({
          scenarioId: newScenario.id,
          year: inp.year,
          salesVolume: inp.salesVolume,
          netPrice: inp.netPrice,
          unitCost: inp.unitCost,
          costQty: inp.costQty,
          cogs: inp.cogs,
          opex: inp.opex,
          capex: inp.capex,
        }))
      );
    }

    return res.status(201).json({ ...newScenario, isBaseline: false, calculation: null });
  } catch (err) {
    req.log.error({ err }, "Failed to duplicate scenario");
    return res.status(500).json({ error: "Failed to duplicate scenario" });
  }
});

// GET /api/scenarios/:id/inputs
router.get("/scenarios/:id/inputs", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inputs = await db
      .select()
      .from(financialInputsTable)
      .where(eq(financialInputsTable.scenarioId, id))
      .orderBy(financialInputsTable.year);
    const mapped = inputs.map((i) => ({
      ...i,
      salesVolume: parseFloat(i.salesVolume),
      netPrice: parseFloat(i.netPrice),
      unitCost: i.unitCost != null ? parseFloat(i.unitCost) : null,
      costQty: i.costQty != null ? parseFloat(i.costQty) : null,
      cogs: parseFloat(i.cogs),
      opex: parseFloat(i.opex),
      capex: parseFloat(i.capex),
    }));
    return res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to get financial inputs");
    return res.status(500).json({ error: "Failed to get financial inputs" });
  }
});

// PUT /api/scenarios/:id/inputs
router.put("/scenarios/:id/inputs", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = SaveFinancialInputsBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const oldInputs = await db
      .select()
      .from(financialInputsTable)
      .where(eq(financialInputsTable.scenarioId, id));

    await db.delete(financialInputsTable).where(eq(financialInputsTable.scenarioId, id));

    const newInputs = await db
      .insert(financialInputsTable)
      .values(
        parsed.data.inputs.map((inp) => ({
          scenarioId: id,
          year: inp.year,
          salesVolume: String(inp.salesVolume),
          netPrice: String(inp.netPrice),
          unitCost: inp.unitCost != null ? String(inp.unitCost) : null,
          costQty: inp.costQty != null ? String(inp.costQty) : null,
          cogs: String(inp.cogs),
          opex: String(inp.opex),
          capex: String(inp.capex),
        }))
      )
      .returning();

    const [scenario] = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.id, id));
    if (scenario) {
      await db.insert(auditLogTable).values({
        tableName: "financial_inputs",
        recordId: scenario.projectId,
        fieldName: "inputs_bulk_update",
        oldValue: String(oldInputs.length),
        newValue: String(newInputs.length),
        changedBy: (req.headers["x-user-id"] as string) || "system",
      });
    }

    const mapped = newInputs.map((i) => ({
      ...i,
      salesVolume: parseFloat(i.salesVolume),
      netPrice: parseFloat(i.netPrice),
      unitCost: i.unitCost != null ? parseFloat(i.unitCost) : null,
      costQty: i.costQty != null ? parseFloat(i.costQty) : null,
      cogs: parseFloat(i.cogs),
      opex: parseFloat(i.opex),
      capex: parseFloat(i.capex),
    }));
    return res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to save financial inputs");
    return res.status(500).json({ error: "Failed to save financial inputs" });
  }
});

// POST /api/scenarios/:id/calculate
router.post("/scenarios/:id/calculate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const inputs = await db
      .select()
      .from(financialInputsTable)
      .where(eq(financialInputsTable.scenarioId, id))
      .orderBy(financialInputsTable.year);

    const [scenario] = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.id, id));
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, scenario.projectId));

    let taxRate = 0.25;
    if (project?.region) {
      const [regional] = await db
        .select()
        .from(regionalParametersTable)
        .where(eq(regionalParametersTable.region, project.region));
      if (regional) taxRate = parseFloat(regional.taxRate);
    }

    let wacc = 0.10;
    const [formula] = await db
      .select()
      .from(formulaDefinitionsTable)
      .orderBy(desc(formulaDefinitionsTable.version))
      .limit(1);
    if (formula) wacc = parseFloat(formula.wacc);

    const mappedInputs = inputs.map((i) => ({
      year: i.year,
      salesVolume: parseFloat(i.salesVolume),
      netPrice: parseFloat(i.netPrice),
      unitCost: i.unitCost != null ? parseFloat(i.unitCost) : null,
      costQty: i.costQty != null ? parseFloat(i.costQty) : null,
      cogs: parseFloat(i.cogs),
      opex: parseFloat(i.opex),
      capex: parseFloat(i.capex),
    }));

    const result = calculateROI(mappedInputs, wacc, taxRate);

    await db.delete(calculationsTable).where(eq(calculationsTable.scenarioId, id));
    const [calc] = await db
      .insert(calculationsTable)
      .values({
        scenarioId: id,
        npv: String(result.npv.toFixed(2)),
        irr: result.irr != null ? String(result.irr.toFixed(6)) : null,
        paybackPeriod: result.paybackPeriod != null ? String(result.paybackPeriod.toFixed(4)) : null,
        roiPercent: result.roiPercent != null ? String(result.roiPercent.toFixed(4)) : null,
        totalRevenue: String(result.totalRevenue.toFixed(2)),
        totalCost: String(result.totalCost.toFixed(2)),
        totalCogs: String(result.totalCogs.toFixed(2)),
        totalCapex: String(result.totalCapex.toFixed(2)),
        cashFlows: JSON.stringify(result.cashFlows),
      })
      .returning();

    await db.insert(auditLogTable).values({
      tableName: "calculations",
      recordId: scenario.projectId,
      fieldName: "calculation_run",
      oldValue: null,
      newValue: `NPV: ${result.npv.toFixed(2)}, IRR: ${result.irr?.toFixed(4) ?? "N/A"}`,
      changedBy: (req.headers["x-user-id"] as string) || "system",
    });

    return res.json(formatCalc(calc));
  } catch (err) {
    req.log.error({ err }, "Failed to calculate scenario");
    return res.status(500).json({ error: "Failed to calculate scenario" });
  }
});

// GET /api/scenarios/:id/calculation
router.get("/scenarios/:id/calculation", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const calc = await getLatestCalc(id);
    if (!calc) return res.status(404).json({ error: "No calculation found" });
    return res.json(formatCalc(calc));
  } catch (err) {
    req.log.error({ err }, "Failed to get calculation");
    return res.status(500).json({ error: "Failed to get calculation" });
  }
});

// suppress unused import
void sql;

export default router;
