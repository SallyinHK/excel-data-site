import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenariosTable,
  calculationsTable,
  projectSalesRegionsTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// GET /api/dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable);

    const totalProjects = projects.length;
    const totalApproved = projects.filter((p) => p.status === "approved").length;
    const totalInReview = projects.filter((p) => p.status === "review").length;
    const totalDraft = projects.filter((p) => p.status === "draft").length;
    const totalInvestment = projects.reduce((sum, p) => {
      return sum + (p.investmentSize ? parseFloat(p.investmentSize) : 0);
    }, 0);

    const allScenarios = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.isBaseline, "true"));

    let npvTotal = 0;
    let irrTotal = 0;
    let calcCount = 0;

    for (const scenario of allScenarios) {
      const [calc] = await db
        .select()
        .from(calculationsTable)
        .where(eq(calculationsTable.scenarioId, scenario.id))
        .orderBy(desc(calculationsTable.calculatedAt))
        .limit(1);
      if (calc) {
        npvTotal += parseFloat(calc.npv);
        if (calc.irr) irrTotal += parseFloat(calc.irr);
        calcCount++;
      }
    }

    const avgNpv = calcCount > 0 ? npvTotal / calcCount : null;
    const avgIrr = calcCount > 0 ? irrTotal / calcCount : null;

    const regionMap: Record<string, { count: number }> = {};
    for (const p of projects) {
      if (!regionMap[p.region]) regionMap[p.region] = { count: 0 };
      regionMap[p.region].count++;
    }

    const byRegion = Object.entries(regionMap).map(([region, data]) => ({
      region,
      count: data.count,
      avgNpv: null as number | null,
    }));

    const statusMap: Record<string, number> = {};
    for (const p of projects) {
      statusMap[p.status] = (statusMap[p.status] || 0) + 1;
    }
    const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    return res.json({
      totalProjects,
      totalApproved,
      totalInReview,
      totalDraft,
      avgNpv,
      avgIrr,
      totalInvestment: totalInvestment || null,
      byRegion,
      byStatus,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    return res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

// GET /api/dashboard/projects
router.get("/dashboard/projects", async (req, res) => {
  try {
    const { region, status, sortBy, sortOrder } = req.query as Record<string, string>;

    const projects = await db.select().from(projectsTable);

    const result = [];
    for (const project of projects) {
      if (status && project.status !== status) continue;

      const [baselineScenario] = await db
        .select()
        .from(scenariosTable)
        .where(eq(scenariosTable.projectId, project.id))
        .orderBy(desc(sql`CASE WHEN ${scenariosTable.isBaseline} = 'true' THEN 0 ELSE 1 END`))
        .limit(1);

      let npv: number | null = null;
      let irr: number | null = null;
      let paybackPeriod: number | null = null;
      let roiPercent: number | null = null;
      let pi: number | null = null;
      let totalRevenue: number | null = null;
      let cm: number | null = null;
      let cmPct: number | null = null;

      if (baselineScenario) {
        const [calc] = await db
          .select()
          .from(calculationsTable)
          .where(eq(calculationsTable.scenarioId, baselineScenario.id))
          .orderBy(desc(calculationsTable.calculatedAt))
          .limit(1);
        if (calc) {
          npv = parseFloat(calc.npv);
          irr = calc.irr ? parseFloat(calc.irr) : null;
          paybackPeriod = calc.paybackPeriod ? parseFloat(calc.paybackPeriod) : null;
          roiPercent = calc.roiPercent ? parseFloat(calc.roiPercent) : null;
          totalRevenue = calc.totalRevenue ? parseFloat(calc.totalRevenue) : null;

          const investment = project.investmentSize ? parseFloat(project.investmentSize) : null;
          if (npv != null && investment != null && investment > 0) {
            pi = (npv + investment) / investment;
          }

          if (totalRevenue != null && calc.totalCogs != null) {
            const totalCogs = parseFloat(calc.totalCogs);
            cm = totalRevenue - totalCogs;
            cmPct = totalRevenue > 0 ? (cm / totalRevenue) * 100 : null;
          }
        }
      }

      // Get sales regions
      const salesRegionRows = await db
        .select()
        .from(projectSalesRegionsTable)
        .where(eq(projectSalesRegionsTable.projectId, project.id));
      const salesRegions = salesRegionRows.map((r) => r.region);

      // Apply region filter: include if primary region matches OR any sales region matches
      if (region && project.region !== region && !salesRegions.includes(region)) continue;

      result.push({
        id: project.id,
        name: project.name,
        region: project.region,
        productCategory: project.productCategory,
        status: project.status,
        investmentSize: project.investmentSize ? parseFloat(project.investmentSize) : null,
        npv,
        irr,
        paybackPeriod,
        roiPercent,
        pi,
        totalRevenue,
        cm,
        cmPct,
        salesRegions,
        createdAt: project.createdAt,
      });
    }

    const validSortFields = ["npv", "irr", "paybackPeriod", "roiPercent", "investmentSize", "pi", "totalRevenue", "cm", "cmPct"];
    const field = validSortFields.includes(sortBy) ? sortBy : "npv";
    const order = sortOrder === "asc" ? 1 : -1;

    result.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[field];
      const bVal = (b as Record<string, unknown>)[field];
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      return ((aVal as number) - (bVal as number)) * order * -1;
    });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard projects");
    return res.status(500).json({ error: "Failed to get dashboard projects" });
  }
});

export default router;
