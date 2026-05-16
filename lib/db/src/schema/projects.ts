import { pgTable, text, serial, timestamp, numeric, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  region: text("region").notNull(),
  productCategory: text("product_category"),
  investmentSize: numeric("investment_size", { precision: 20, scale: 2 }),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const scenariosTable = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  name: text("name").notNull(),
  isBaseline: text("is_baseline").notNull().default("false"),
  lifecycleYears: integer("lifecycle_years").notNull().default(5),
  assumptionsSummary: text("assumptions_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScenarioSchema = createInsertSchema(scenariosTable).omit({ id: true, createdAt: true });
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Scenario = typeof scenariosTable.$inferSelect;

export const projectSalesRegionsTable = pgTable(
  "project_sales_regions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    region: text("region").notNull(),
    fxMultiplier: numeric("fx_multiplier", { precision: 10, scale: 6 }).notNull().default("1"),
  },
  (t) => [unique("uq_project_region").on(t.projectId, t.region)]
);

export const insertProjectSalesRegionSchema = createInsertSchema(projectSalesRegionsTable).omit({ id: true });
export type InsertProjectSalesRegion = z.infer<typeof insertProjectSalesRegionSchema>;
export type ProjectSalesRegion = typeof projectSalesRegionsTable.$inferSelect;
