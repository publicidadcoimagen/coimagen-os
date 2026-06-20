import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import projectsRouter from "./projects";
import agentsRouter from "./agents";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(agentsRouter);
router.use(tasksRouter);
router.use(dashboardRouter);

export default router;
