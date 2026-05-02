import { Router } from "express";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
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

  // 1. Ensure room exists
  const roomService = new RoomServiceClient(serverUrl, apiKey, apiSecret);
  try {
    await roomService.createRoom({ name: roomName });
  } catch {
    // Room already exists — that's fine
  }

  // 2. Explicitly dispatch our named agent to this room.
  //    This works whether the room is new or already existed, and
  //    overrides any default cloud agent (e.g. Aria) that might otherwise answer.
  const dispatchClient = new AgentDispatchClient(serverUrl, apiKey, apiSecret);
  try {
    const existing = await dispatchClient.listDispatch(roomName);
    const alreadyDispatched = existing.some((d) => d.agentName === AGENT_NAME);
    if (!alreadyDispatched) {
      await dispatchClient.createDispatch(roomName, AGENT_NAME);
      req.log.info({ roomName, agentName: AGENT_NAME }, "Agent dispatch created");
    } else {
      req.log.info({ roomName, agentName: AGENT_NAME }, "Agent already dispatched to room");
    }
  } catch (err) {
    req.log.warn({ err, roomName }, "Agent dispatch failed — bot may not respond");
  }

  // 3. Generate participant access token
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

  // 4. Record session in DB
  await db
    .insert(voiceSessionsTable)
    .values({ roomName, participantName, startedAt: new Date() })
    .onConflictDoNothing();

  res.json({ token, roomName, serverUrl });
});

export default router;
