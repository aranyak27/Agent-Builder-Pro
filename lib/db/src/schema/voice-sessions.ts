import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const voiceSessionsTable = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  roomName: text("room_name").notNull(),
  participantName: text("participant_name").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
});

export const insertVoiceSessionSchema = createInsertSchema(voiceSessionsTable).omit({ id: true });
export type InsertVoiceSession = z.infer<typeof insertVoiceSessionSchema>;
export type VoiceSession = typeof voiceSessionsTable.$inferSelect;
