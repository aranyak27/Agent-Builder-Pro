import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { voiceSessionsTable } from "./voice-sessions";

export const voiceMessagesTable = pgTable("voice_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => voiceSessionsTable.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoiceMessageSchema = createInsertSchema(voiceMessagesTable).omit({ id: true });
export type InsertVoiceMessage = z.infer<typeof insertVoiceMessageSchema>;
export type VoiceMessage = typeof voiceMessagesTable.$inferSelect;
