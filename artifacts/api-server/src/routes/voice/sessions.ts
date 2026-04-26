import { Router } from "express";
import { db } from "@workspace/db";
import { voiceSessionsTable, voiceMessagesTable } from "@workspace/db";
import { desc, eq, count, avg, sql, gte } from "drizzle-orm";
import {
  ListVoiceSessionsQueryParams,
  GetVoiceSessionParams,
  GetVoiceSessionMessagesParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/sessions", async (req, res) => {
  const parse = ListVoiceSessionsQueryParams.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const { limit, offset } = parse.data;

  const [sessions, totalResult] = await Promise.all([
    db
      .select({
        id: voiceSessionsTable.id,
        roomName: voiceSessionsTable.roomName,
        participantName: voiceSessionsTable.participantName,
        startedAt: voiceSessionsTable.startedAt,
        endedAt: voiceSessionsTable.endedAt,
        durationSeconds: voiceSessionsTable.durationSeconds,
        messageCount: count(voiceMessagesTable.id),
      })
      .from(voiceSessionsTable)
      .leftJoin(voiceMessagesTable, eq(voiceSessionsTable.id, voiceMessagesTable.sessionId))
      .groupBy(voiceSessionsTable.id)
      .orderBy(desc(voiceSessionsTable.startedAt))
      .limit(limit ?? 20)
      .offset(offset ?? 0),
    db.select({ count: count() }).from(voiceSessionsTable),
  ]);

  res.json({ sessions, total: totalResult[0]?.count ?? 0 });
});

router.get("/sessions/:id", async (req, res) => {
  const parse = GetVoiceSessionParams.safeParse(req.params);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const { id } = parse.data;

  const rows = await db
    .select({
      id: voiceSessionsTable.id,
      roomName: voiceSessionsTable.roomName,
      participantName: voiceSessionsTable.participantName,
      startedAt: voiceSessionsTable.startedAt,
      endedAt: voiceSessionsTable.endedAt,
      durationSeconds: voiceSessionsTable.durationSeconds,
      messageCount: count(voiceMessagesTable.id),
    })
    .from(voiceSessionsTable)
    .leftJoin(voiceMessagesTable, eq(voiceSessionsTable.id, voiceMessagesTable.sessionId))
    .groupBy(voiceSessionsTable.id)
    .where(eq(voiceSessionsTable.id, id));

  if (!rows.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(rows[0]);
});

router.get("/sessions/:id/messages", async (req, res) => {
  const parse = GetVoiceSessionMessagesParams.safeParse(req.params);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const { id } = parse.data;

  const messages = await db
    .select()
    .from(voiceMessagesTable)
    .where(eq(voiceMessagesTable.sessionId, id))
    .orderBy(voiceMessagesTable.createdAt);

  res.json({ messages });
});

router.get("/stats", async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totals, todayCount] = await Promise.all([
    db
      .select({
        totalSessions: count(),
        totalMessages: sql<number>`coalesce(sum((select count(*) from ${voiceMessagesTable} where ${voiceMessagesTable.sessionId} = ${voiceSessionsTable.id})), 0)`,
        avgDurationSeconds: avg(voiceSessionsTable.durationSeconds),
      })
      .from(voiceSessionsTable),
    db
      .select({ count: count() })
      .from(voiceSessionsTable)
      .where(gte(voiceSessionsTable.startedAt, today)),
  ]);

  const t = totals[0];

  res.json({
    totalSessions: t?.totalSessions ?? 0,
    totalMessages: Number(t?.totalMessages ?? 0),
    avgDurationSeconds: t?.avgDurationSeconds ? Number(t.avgDurationSeconds) : null,
    sessionsToday: todayCount[0]?.count ?? 0,
  });
});

export default router;
