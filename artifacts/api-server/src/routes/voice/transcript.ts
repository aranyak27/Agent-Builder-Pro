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
  let [session] = await db
    .select({ id: voiceSessionsTable.id })
    .from(voiceSessionsTable)
    .where(eq(voiceSessionsTable.roomName, roomName))
    .orderBy(desc(voiceSessionsTable.startedAt))
    .limit(1);

  // If no session exists yet (e.g. worker picked up a call before token route ran,
  // or the session is in a different DB), create a placeholder so data is never lost.
  if (!session) {
    req.log.warn({ roomName }, "No session found for room — creating placeholder session");
    const [created] = await db
      .insert(voiceSessionsTable)
      .values({ roomName, participantName: "unknown", startedAt: new Date() })
      .returning({ id: voiceSessionsTable.id });
    session = created;
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
