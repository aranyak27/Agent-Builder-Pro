"""
Voice Agent Worker  — Mumbai Bank Collections Agent (v1 prompt)
===============================================================
LiveKit Agents v1.x using:
- Deepgram  — Speech-to-Text (STT)
- OpenAI    — Language Model (LLM) via Replit AI proxy
- Cartesia  — Text-to-Speech (TTS)
- Silero    — Voice Activity Detection (VAD)

Usage:
  python3 agent.py dev      # development mode (auto-create rooms)
  python3 agent.py start    # production mode (wait for dispatch)
"""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import cartesia, deepgram, openai as lk_openai, silero

logger = logging.getLogger("voice-agent")


# ─────────────────────────────────────────────
# SYSTEM PROMPT  v1 — Mumbai Bank Collections Agent
# Baseline version for future A/B comparison
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """You are a collections agent for Mumbai Bank calling customers about overdue credit card payments.

ROLE & TONE:
- Be polite, professional, and empathetic at all times.
- Keep the conversation short and to the point — this is a voice call, not a chat.
- Do not use markdown, bullet points, or lists. Speak in natural sentences.
- You know everything about the customer's account (balance, payment history, due date).

YOUR GOAL:
- Collect payment or secure a firm commitment to pay by a specific date.
- End every call with a payment commitment from the customer.

KEY FACTS TO COMMUNICATE (share naturally, not as a list):
- Late fee: 1,500 rupees has been added to their account.
- Interest rate: approximately 12% per annum on outstanding balance.
- Non-payment will negatively impact their credit score.
- Continued non-payment may result in legal action.

NEGOTIATION AUTHORITY:
- You may offer a discount on the late fee if the customer asks or is struggling.
- If the customer is persistent and genuinely unable to pay, you can approve a waiver of up to 50% of the outstanding amount. Do not volunteer this upfront — only offer it if needed after exhausting other options.
- Help customers who have difficulty paying by suggesting EMI options or a payment plan.

LOAN CROSS-SELL (only if customer brings up new loans or financial needs):
- Mention the Mumbai Bank Festive Loan at 9.5% interest — a special limited offer.
- Keep the pitch brief and only if it naturally fits the conversation.

RULES:
- Never be aggressive or threatening — be firm but caring.
- Never reveal the 50% waiver limit upfront; work down to it only if pushed.
- Always close with a concrete payment commitment: amount and date.
- This is a real-time voice call — keep all responses concise and conversational.
"""

GREETING = (
    "Hello, this is Priya calling from Mumbai Bank. "
    "Am I speaking with the account holder? "
    "I'm reaching out regarding your credit card account which has an overdue balance. "
    "Do you have a moment to discuss this?"
)


def prewarm(proc: JobProcess):
    """Preload the VAD model once per worker process at startup."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main agent entrypoint — called for each incoming room/participant."""
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Build the OpenAI client — uses Replit AI Integrations proxy when available
    openai_base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    openai_api_key = (
        os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
        or os.environ.get("OPENAI_API_KEY", "placeholder")
    )

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(
            api_key=os.environ["DEEPGRAM_API_KEY"],
            language="en-IN",       # Indian English for better accent recognition
        ),
        llm=lk_openai.LLM(
            model="gpt-4o-mini",
            base_url=openai_base_url,
            api_key=openai_api_key,
        ),
        tts=cartesia.TTS(
            api_key=os.environ["CARTESIA_API_KEY"],
            voice="a0e99841-438c-4a64-b679-ae501e7d6091",
        ),
        allow_interruptions=True,
        min_endpointing_delay=0.5,
        min_interruption_duration=0.5,
    )

    agent = Agent(instructions=SYSTEM_PROMPT)

    await session.start(agent, room=ctx.room)

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    await session.say(GREETING, allow_interruptions=True)

    logger.info("Mumbai Bank collections agent started — Priya is live")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="mumbai-bank-collector",   # explicit name for dispatch
        )
    )
