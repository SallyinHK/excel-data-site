import { Router } from "express";
import { db } from "@workspace/db";
import {
  regionalParametersTable,
  formulaDefinitionsTable,
  auditLogTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateRegionalParameterBody,
  UpdateRegionalParameterBody,
  CreateFormulaDefinitionBody,
  UpdateFormulaDefinitionBody,
} from "@workspace/api-zod";

const router = Router();

// GET /api/regional-parameters
router.get("/regional-parameters", async (req, res) => {
  try {
    const params = await db
      .select()
      .from(regionalParametersTable)
      .orderBy(regionalParametersTable.region);
    const mapped = params.map((p) => ({
      ...p,
      taxRate: parseFloat(p.taxRate),
      exchangeRateToUsd: parseFloat(p.exchangeRateToUsd),
    }));
    return res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to list regional parameters");
    return res.status(500).json({ error: "Failed to list regional parameters" });
  }
});

// POST /api/regional-parameters
router.post("/regional-parameters", async (req, res) => {
  try {
    const parsed = CreateRegionalParameterBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { region, taxRate, currency, exchangeRateToUsd, effectiveDate } = parsed.data;
    const [param] = await db
      .insert(regionalParametersTable)
      .values({
        region,
        taxRate: String(taxRate),
        currency,
        exchangeRateToUsd: String(exchangeRateToUsd),
        effectiveDate,
      })
      .returning();
    return res.status(201).json({
      ...param,
      taxRate: parseFloat(param.taxRate),
      exchangeRateToUsd: parseFloat(param.exchangeRateToUsd),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create regional parameter");
    return res.status(500).json({ error: "Failed to create regional parameter" });
  }
});

// PATCH /api/regional-parameters/:id
router.patch("/regional-parameters/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateRegionalParameterBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const updateData: Record<string, unknown> = {};
    const { taxRate, currency, exchangeRateToUsd, effectiveDate } = parsed.data;
    if (taxRate !== undefined) updateData.taxRate = String(taxRate);
    if (currency !== undefined) updateData.currency = currency;
    if (exchangeRateToUsd !== undefined) updateData.exchangeRateToUsd = String(exchangeRateToUsd);
    if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate;

    const [updated] = await db
      .update(regionalParametersTable)
      .set(updateData)
      .where(eq(regionalParametersTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json({
      ...updated,
      taxRate: parseFloat(updated.taxRate),
      exchangeRateToUsd: parseFloat(updated.exchangeRateToUsd),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update regional parameter");
    return res.status(500).json({ error: "Failed to update regional parameter" });
  }
});

// GET /api/formula-definitions
router.get("/formula-definitions", async (req, res) => {
  try {
    const formulas = await db
      .select()
      .from(formulaDefinitionsTable)
      .orderBy(desc(formulaDefinitionsTable.version));
    const mapped = formulas.map((f) => ({
      ...f,
      wacc: parseFloat(f.wacc),
      discountRate: parseFloat(f.discountRate),
    }));
    return res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to list formula definitions");
    return res.status(500).json({ error: "Failed to list formula definitions" });
  }
});

// POST /api/formula-definitions
router.post("/formula-definitions", async (req, res) => {
  try {
    const parsed = CreateFormulaDefinitionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { formulaType, wacc, discountRate, parametersJson, locked } = parsed.data;
    const [formula] = await db
      .insert(formulaDefinitionsTable)
      .values({
        formulaType,
        wacc: String(wacc),
        discountRate: String(discountRate),
        parametersJson: parametersJson ?? null,
        locked: locked ?? false,
        version: 1,
      })
      .returning();
    return res.status(201).json({
      ...formula,
      wacc: parseFloat(formula.wacc),
      discountRate: parseFloat(formula.discountRate),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create formula definition");
    return res.status(500).json({ error: "Failed to create formula definition" });
  }
});

// PATCH /api/formula-definitions/:id
router.patch("/formula-definitions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateFormulaDefinitionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const [existing] = await db
      .select()
      .from(formulaDefinitionsTable)
      .where(eq(formulaDefinitionsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updateData: Record<string, unknown> = { version: existing.version + 1 };
    const { wacc, discountRate, parametersJson, locked } = parsed.data;
    if (wacc !== undefined) updateData.wacc = String(wacc);
    if (discountRate !== undefined) updateData.discountRate = String(discountRate);
    if (parametersJson !== undefined) updateData.parametersJson = parametersJson;
    if (locked !== undefined) updateData.locked = locked;
    updateData.updatedBy = (req.headers["x-user-id"] as string) || "admin";

    const [updated] = await db
      .update(formulaDefinitionsTable)
      .set(updateData)
      .where(eq(formulaDefinitionsTable.id, id))
      .returning();

    await db.insert(auditLogTable).values({
      tableName: "formula_definitions",
      recordId: id,
      fieldName: "formula_update",
      oldValue: `wacc:${existing.wacc}, discountRate:${existing.discountRate}, locked:${existing.locked}`,
      newValue: `wacc:${updated.wacc}, discountRate:${updated.discountRate}, locked:${updated.locked}`,
      changedBy: (req.headers["x-user-id"] as string) || "admin",
    });

    return res.json({
      ...updated,
      wacc: parseFloat(updated.wacc),
      discountRate: parseFloat(updated.discountRate),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update formula definition");
    return res.status(500).json({ error: "Failed to update formula definition" });
  }
});

// suppress unused
void desc;

export default router;
