import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenariosTable,
  auditLogTable,
  projectSalesRegionsTable,
} from "@workspace/db";
import { eq, ilike, and, desc, type SQL } from "drizzle-orm";
import {
  CreateProjectBody,
  UpdateProjectBody,
} from "@workspace/api-zod";

const router = Router();

// GET /api/projects
router.get("/projects", async (req, res) => {
  try {
    const { region, status, search } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (region) conditions.push(eq(projectsTable.region, region));
    if (status) conditions.push(eq(projectsTable.status, status));
    if (search) conditions.push(ilike(projectsTable.name, `%${search}%`));

    const projects = await db
      .select()
      .from(projectsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(projectsTable.createdAt));
    return res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    return res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /api/projects
router.post("/projects", async (req, res) => {
  try {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { name, description, region, productCategory, investmentSize, createdBy } = parsed.data;
    const [project] = await db
      .insert(projectsTable)
      .values({
        name,
        description: description ?? null,
        region,
        productCategory: productCategory ?? null,
        investmentSize: investmentSize != null ? String(investmentSize) : null,
        status: "draft",
        createdBy: createdBy ?? "system",
      })
      .returning();
    return res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to create project");
    return res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects/:id
router.get("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    return res.json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    return res.status(500).json({ error: "Failed to get project" });
  }
});

// PATCH /api/projects/:id
router.patch("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const [oldProject] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));
    if (!oldProject) return res.status(404).json({ error: "Project not found" });

    const updateData: Record<string, unknown> = {};
    const { name, description, region, productCategory, investmentSize, status } = parsed.data;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (region !== undefined) updateData.region = region;
    if (productCategory !== undefined) updateData.productCategory = productCategory;
    if (investmentSize !== undefined) updateData.investmentSize = String(investmentSize);
    if (status !== undefined) updateData.status = status;

    const [updated] = await db
      .update(projectsTable)
      .set(updateData)
      .where(eq(projectsTable.id, id))
      .returning();

    const auditEntries = [];
    for (const [field, newVal] of Object.entries(updateData)) {
      const oldVal = (oldProject as Record<string, unknown>)[field];
      if (String(oldVal) !== String(newVal)) {
        auditEntries.push({
          tableName: "projects",
          recordId: id,
          fieldName: field,
          oldValue: String(oldVal ?? ""),
          newValue: String(newVal ?? ""),
          changedBy: (req.headers["x-user-id"] as string) || "system",
        });
      }
    }
    if (auditEntries.length > 0) {
      await db.insert(auditLogTable).values(auditEntries);
    }

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update project");
    return res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id
router.delete("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(projectsTable)
      .set({ status: "archived" })
      .where(eq(projectsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete project");
    return res.status(500).json({ error: "Failed to delete project" });
  }
});

// GET /api/projects/:id/audit-log
router.get("/projects/:id/audit-log", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.recordId, id))
      .orderBy(desc(auditLogTable.changedAt));
    return res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to get audit log");
    return res.status(500).json({ error: "Failed to get audit log" });
  }
});

// GET /api/projects/:id/regions
router.get("/projects/:id/regions", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const rows = await db
      .select()
      .from(projectSalesRegionsTable)
      .where(eq(projectSalesRegionsTable.projectId, projectId));
    return res.json(rows.map((r) => ({ ...r, fxMultiplier: parseFloat(r.fxMultiplier) })));
  } catch (err) {
    req.log.error({ err }, "Failed to list sales regions");
    return res.status(500).json({ error: "Failed to list sales regions" });
  }
});

// POST /api/projects/:id/regions
router.post("/projects/:id/regions", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { region, fxMultiplier } = req.body as { region?: unknown; fxMultiplier?: unknown };
    if (!region || typeof region !== "string") {
      return res.status(400).json({ error: "region is required" });
    }
    const fx = fxMultiplier != null ? Number(fxMultiplier) : 1;
    if (isNaN(fx) || fx <= 0) {
      return res.status(400).json({ error: "fxMultiplier must be a positive number" });
    }
    const [row] = await db
      .insert(projectSalesRegionsTable)
      .values({ projectId, region, fxMultiplier: String(fx) })
      .onConflictDoNothing()
      .returning();
    if (!row) return res.status(409).json({ error: "Region already added to this project" });
    return res.status(201).json({ ...row, fxMultiplier: parseFloat(row.fxMultiplier) });
  } catch (err) {
    req.log.error({ err }, "Failed to add sales region");
    return res.status(500).json({ error: "Failed to add sales region" });
  }
});

// PATCH /api/projects/:id/regions/:regionId
router.patch("/projects/:id/regions/:regionId", async (req, res) => {
  try {
    const regionId = parseInt(req.params.regionId);
    const { fxMultiplier } = req.body as { fxMultiplier?: unknown };
    const fx = Number(fxMultiplier);
    if (isNaN(fx) || fx <= 0) {
      return res.status(400).json({ error: "fxMultiplier must be a positive number" });
    }
    const [updated] = await db
      .update(projectSalesRegionsTable)
      .set({ fxMultiplier: String(fx) })
      .where(eq(projectSalesRegionsTable.id, regionId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Region entry not found" });
    return res.json({ ...updated, fxMultiplier: parseFloat(updated.fxMultiplier) });
  } catch (err) {
    req.log.error({ err }, "Failed to update sales region");
    return res.status(500).json({ error: "Failed to update sales region" });
  }
});

// DELETE /api/projects/:id/regions/:regionId
router.delete("/projects/:id/regions/:regionId", async (req, res) => {
  try {
    const regionId = parseInt(req.params.regionId);
    await db.delete(projectSalesRegionsTable).where(eq(projectSalesRegionsTable.id, regionId));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove sales region");
    return res.status(500).json({ error: "Failed to remove sales region" });
  }
});

// Suppress unused import warning
void scenariosTable;

export default router;
