"""
Voice Agent Worker
==================
LiveKit voice agent using:
- Deepgram  — Speech-to-Text (STT)
- OpenAI    — Language Model (LLM)
- Cartesia  — Text-to-Speech (TTS)

Usage:
  python3 agent.py dev      # development mode (auto-create rooms)
  python3 agent.py start    # production mode (wait for dispatch)
"""

import os
import asyncio
import logging
from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import cartesia, deepgram, openai as lk_openai, silero

logger = logging.getLogger("voice-agent")


# ─────────────────────────────────────────────
# SYSTEM PROMPT  (placeholder — define in chat)
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """You are a helpful, concise voice assistant.
Keep responses short and conversational — this is a real-time voice call.
Do not use markdown or lists in your responses.
"""


def prewarm(proc: JobProcess):
    """
    Preload the Voice Activity Detection (VAD) model.
    This runs once per worker process at startup.
    """
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """
    Main agent entrypoint — called for each incoming room/participant.
    """
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    # Build the OpenAI client — points to Replit AI Integrations proxy
    # if AI_INTEGRATIONS_OPENAI_BASE_URL is set, otherwise falls back to
    # standard OpenAI endpoint (requires OPENAI_API_KEY).
    openai_base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    openai_api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "placeholder")

    llm_model = lk_openai.LLM(
        model="gpt-4o-mini",
        base_url=openai_base_url,
        api_key=openai_api_key,
    )

    initial_ctx = llm.ChatContext().append(
        role="system",
        text=SYSTEM_PROMPT,
    )

    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(
            api_key=os.environ["DEEPGRAM_API_KEY"],
            language="en-US",
        ),
        llm=llm_model,
        tts=cartesia.TTS(
            api_key=os.environ["CARTESIA_API_KEY"],
            # Default voice — can be changed to any Cartesia voice ID
            voice="a0e99841-438c-4a64-b679-ae501e7d6091",
        ),
        chat_ctx=initial_ctx,
        # Interruption settings
        allow_interruptions=True,
        interrupt_speech_duration=0.5,
        interrupt_min_words=0,
        # Turn-ending sensitivity
        min_endpointing_delay=0.5,
    )

    agent.start(ctx.room, participant)

    await agent.say(
        "Hello! I'm your voice assistant. How can I help you today?",
        allow_interruptions=True,
    )

    logger.info("Agent started and greeting sent")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
