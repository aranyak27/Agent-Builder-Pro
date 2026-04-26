import { Router } from "express";
import { WebhookReceiver } from "livekit-server-sdk";
import { db } from "@workspace/db";
import { voiceSessionsTable, voiceMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

router.post(
  "/webhook",
  async (req, res) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      res.status(500).json({ error: "LiveKit credentials not configured" });
      return;
    }

    try {
      const receiver = new WebhookReceiver(apiKey, apiSecret);
      const authHeader = req.headers["authorization"] as string;
      const event = await receiver.receive(JSON.stringify(req.body), authHeader);

      logger.info({ event: event.event, room: event.room?.name }, "LiveKit webhook received");

      if (event.event === "room_finished" && event.room) {
        const roomName = event.room.name;
        const sessions = await db
          .select()
          .from(voiceSessionsTable)
          .where(eq(voiceSessionsTable.roomName, roomName));

        if (sessions.length > 0) {
          const session = sessions[0];
          const endedAt = new Date();
          const durationSeconds = Math.floor(
            (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
          );

          await db
            .update(voiceSessionsTable)
            .set({ endedAt, durationSeconds })
            .where(eq(voiceSessionsTable.id, session.id));
        }
      }

      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "LiveKit webhook error");
      res.status(400).json({ error: "Invalid webhook" });
    }
  }
);

export { router as voiceWebhookRouter };
export default router;
