import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import conversationsRouter from "./conversations";
import walletRouter from "./wallet";
import safetyRouter from "./safety";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(conversationsRouter);
router.use(walletRouter);
router.use(safetyRouter);

export default router;
