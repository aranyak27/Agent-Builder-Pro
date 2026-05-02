import { Router } from "express";
import { db, voiceSessionsTable, voiceMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.post("/transcript", async (req, res) => {
  const { roomName, role, content } = req.body ?? {};

  if (!roomName || typeof roomName !== "string") {
    res.status(400).json({ error: "roomName is required" });
    return;
  }
  if (!role || (role !== "user" && role !== "assistant")) {
    res.status(400).json({ error: "role must be 'user' or 'assistant'" });
    return;
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content must be a non-empty string" });
    return;
  }

  // Find the most recent session for this room
  const [session] = await db
    .select({ id: voiceSessionsTable.id })
    .from(voiceSessionsTable)
    .where(eq(voiceSessionsTable.roomName, roomName))
    .orderBy(desc(voiceSessionsTable.startedAt))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found for room: " + roomName });
    return;
  }

  const [inserted] = await db
    .insert(voiceMessagesTable)
    .values({ sessionId: session.id, role, content: content.trim() })
    .returning({ id: voiceMessagesTable.id });

  req.log.info(
    { sessionId: session.id, role, length: content.trim().length },
    "Transcript message saved"
  );

  res.json({ ok: true, messageId: inserted.id, sessionId: session.id });
});

export default router;
