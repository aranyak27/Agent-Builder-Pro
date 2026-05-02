import { Router } from "express";
import { db, voiceSessionsTable, OUTCOME_TYPES, type OutcomeType } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.post("/outcome", async (req, res) => {
  const { roomName, outcomeType, outcomeData, confidence, needsReview } = req.body ?? {};

  if (!roomName || typeof roomName !== "string") {
    res.status(400).json({ error: "roomName is required" });
    return;
  }
  if (!outcomeType || !(OUTCOME_TYPES as readonly string[]).includes(outcomeType)) {
    res.status(400).json({ error: `outcomeType must be one of: ${OUTCOME_TYPES.join(", ")}` });
    return;
  }
  if (!outcomeData || typeof outcomeData !== "object" || Array.isArray(outcomeData)) {
    res.status(400).json({ error: "outcomeData must be an object" });
    return;
  }

  const confidenceValue = typeof confidence === "number" ? Math.max(0, Math.min(100, Math.round(confidence))) : null;
  const needsReviewValue = typeof needsReview === "boolean" ? needsReview : (confidenceValue !== null ? confidenceValue < 80 : false);

  // Find the most recent session for this room
  const [session] = await db
    .select()
    .from(voiceSessionsTable)
    .where(eq(voiceSessionsTable.roomName, roomName))
    .orderBy(desc(voiceSessionsTable.startedAt))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found for room: " + roomName });
    return;
  }

  // Persist outcome to DB
  await db
    .update(voiceSessionsTable)
    .set({ outcomeType, outcomeData, confidence: confidenceValue, needsReview: needsReviewValue })
    .where(eq(voiceSessionsTable.id, session.id));

  req.log.info(
    { sessionId: session.id, outcomeType, outcomeData, confidence: confidenceValue, needsReview: needsReviewValue },
    "Call outcome captured"
  );

  // Forward to external CRM webhook if configured
  const webhookUrl = process.env.OUTCOME_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const payload = {
        event: "call_outcome",
        sessionId: session.id,
        roomName,
        participantName: session.participantName,
        startedAt: session.startedAt,
        outcomeType,
        outcomeData,
        confidence: confidenceValue,
        needsReview: needsReviewValue,
        capturedAt: new Date().toISOString(),
      };
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      req.log.info({ webhookUrl }, "Outcome forwarded to CRM webhook");
    } catch (err) {
      req.log.warn({ err, webhookUrl }, "Failed to forward outcome to CRM webhook");
    }
  }

  res.json({ ok: true, sessionId: session.id, outcomeType, needsReview: needsReviewValue });
});

export default router;
