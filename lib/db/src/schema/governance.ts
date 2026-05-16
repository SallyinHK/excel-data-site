import { pgTable, text, serial, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const regionalParametersTable = pgTable("regional_parameters", {
  id: serial("id").primaryKey(),
  region: text("region").notNull().unique(),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }).notNull(),
  currency: text("currency").notNull(),
  exchangeRateToUsd: numeric("exchange_rate_to_usd", { precision: 12, scale: 6 }).notNull(),
  effectiveDate: text("effective_date").notNull(),
});

export const insertRegionalParameterSchema = createInsertSchema(regionalParametersTable).omit({ id: true });
export type InsertRegionalParameter = z.infer<typeof insertRegionalParameterSchema>;
export type RegionalParameter = typeof regionalParametersTable.$inferSelect;

export const formulaDefinitionsTable = pgTable("formula_definitions", {
  id: serial("id").primaryKey(),
  formulaType: text("formula_type").notNull(),
  wacc: numeric("wacc", { precision: 8, scale: 4 }).notNull(),
  discountRate: numeric("discount_rate", { precision: 8, scale: 4 }).notNull(),
  parametersJson: text("parameters_json"),
  locked: boolean("locked").notNull().default(false),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFormulaDefinitionSchema = createInsertSchema(formulaDefinitionsTable).omit({ id: true, updatedAt: true });
export type InsertFormulaDefinition = z.infer<typeof insertFormulaDefinitionSchema>;
export type FormulaDefinition = typeof formulaDefinitionsTable.$inferSelect;

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: integer("record_id").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({ id: true, changedAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogTable.$inferSelect;
