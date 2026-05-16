import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import scenariosRouter from "./scenarios";
import governanceRouter from "./governance";
import dashboardRouter from "./dashboard";
import sheetsRouter from "./sheets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(scenariosRouter);
router.use(governanceRouter);
router.use(dashboardRouter);
router.use(sheetsRouter);

export default router;
