import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const OUTCOME_TYPES = ["promise_to_pay", "already_paid", "callback_request", "dispute", "transfer_to_human"] as const;
export type OutcomeType = typeof OUTCOME_TYPES[number];

export const voiceSessionsTable = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  roomName: text("room_name").notNull(),
  participantName: text("participant_name").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
  outcomeType: text("outcome_type").$type<OutcomeType>(),
  outcomeData: jsonb("outcome_data").$type<Record<string, string>>(),
  confidence: integer("confidence"),
  needsReview: boolean("needs_review").default(false).notNull(),
});

export const insertVoiceSessionSchema = createInsertSchema(voiceSessionsTable).omit({ id: true });
export type InsertVoiceSession = z.infer<typeof insertVoiceSessionSchema>;
export type VoiceSession = typeof voiceSessionsTable.$inferSelect;
