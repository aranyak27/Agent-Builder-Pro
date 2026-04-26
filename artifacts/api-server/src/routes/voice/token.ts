import { Router } from "express";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { CreateVoiceTokenBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { voiceSessionsTable } from "@workspace/db";

const router = Router();

const AGENT_NAME = "mumbai-bank-collector";

router.post("/token", async (req, res) => {
  const parse = CreateVoiceTokenBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const { roomName, participantName } = parse.data;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    res.status(500).json({ error: "LiveKit credentials not configured" });
    return;
  }

  // Create the room with our named agent explicitly dispatched to it.
  // This ensures "mumbai-bank-collector" handles the room — not any default cloud agent.
  const roomService = new RoomServiceClient(serverUrl, apiKey, apiSecret);
  try {
    await roomService.createRoom({
      name: roomName,
      agents: [{ agentName: AGENT_NAME }],
    });
  } catch (err: any) {
    // Room may already exist — that's fine, ignore the conflict
    if (!err?.message?.includes("already exists")) {
      console.error("Failed to create/configure room:", err);
    }
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: participantName,
    ttl: "10m",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  await db.insert(voiceSessionsTable).values({
    roomName,
    participantName,
    startedAt: new Date(),
  }).onConflictDoNothing();

  res.json({
    token,
    roomName,
    serverUrl,
  });
});

export default router;
