import { pgTable, serial, integer, numeric, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scenariosTable } from "./projects";

export const financialInputsTable = pgTable("financial_inputs", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").notNull().references(() => scenariosTable.id),
  year: integer("year").notNull(),
  salesVolume: numeric("sales_volume", { precision: 20, scale: 2 }).notNull().default("0"),
  netPrice: numeric("net_price", { precision: 20, scale: 4 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 20, scale: 4 }),
  costQty: numeric("cost_qty", { precision: 20, scale: 2 }),
  cogs: numeric("cogs", { precision: 20, scale: 2 }).notNull().default("0"),
  opex: numeric("opex", { precision: 20, scale: 2 }).notNull().default("0"),
  capex: numeric("capex", { precision: 20, scale: 2 }).notNull().default("0"),
});

export const insertFinancialInputSchema = createInsertSchema(financialInputsTable).omit({ id: true });
export type InsertFinancialInput = z.infer<typeof insertFinancialInputSchema>;
export type FinancialInput = typeof financialInputsTable.$inferSelect;

export const calculationsTable = pgTable("calculations", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").notNull().references(() => scenariosTable.id),
  npv: numeric("npv", { precision: 20, scale: 2 }).notNull(),
  irr: numeric("irr", { precision: 10, scale: 6 }),
  paybackPeriod: numeric("payback_period", { precision: 10, scale: 4 }),
  roiPercent: numeric("roi_percent", { precision: 10, scale: 4 }),
  totalRevenue: numeric("total_revenue", { precision: 20, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 20, scale: 2 }),
  totalCogs: numeric("total_cogs", { precision: 20, scale: 2 }),
  totalCapex: numeric("total_capex", { precision: 20, scale: 2 }),
  cashFlows: text("cash_flows"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCalculationSchema = createInsertSchema(calculationsTable).omit({ id: true, calculatedAt: true });
export type InsertCalculation = z.infer<typeof insertCalculationSchema>;
export type Calculation = typeof calculationsTable.$inferSelect;
