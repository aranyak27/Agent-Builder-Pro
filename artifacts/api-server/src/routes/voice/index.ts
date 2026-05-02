import { Router } from "express";
import tokenRouter from "./token";
import sessionsRouter from "./sessions";
import webhookRouter from "./webhook";
import outcomeRouter from "./outcome";

const router = Router();

router.use(tokenRouter);
router.use(sessionsRouter);
router.use(webhookRouter);
router.use(outcomeRouter);

export default router;
