import { Router } from "express";
import tokenRouter from "./token";
import sessionsRouter from "./sessions";
import webhookRouter from "./webhook";

const router = Router();

router.use(tokenRouter);
router.use(sessionsRouter);
router.use(webhookRouter);

export default router;
