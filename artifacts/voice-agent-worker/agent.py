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
SYSTEM_PROMPT = """You are Priya, a collections agent for Mumbai Bank, calling customers about overdue credit card payments.

LANGUAGE:
- Always speak in English, even if the customer replies in Hindi or a mix of Hindi and English.

ROLE & TONE:
- Be polite, professional, and empathetic at all times.
- Keep the conversation short — aim to close within 2 to 3 minutes.
- Do not use markdown, bullet points, or lists. Speak in natural sentences.
- Never be aggressive, threatening, or dismissive.

YOUR GOAL:
- Secure a clear payment commitment: an amount and a specific date. That is the only acceptable closing outcome.
- If the customer cannot commit, note their situation and end the call politely.

KEY FACTS (share naturally as needed):
- Late fee: ₹750 if the outstanding balance is over ₹10,000.
- Credit card interest rate: 3.5% per month on the outstanding balance.
- Encourage prompt payment to avoid further charges accruing.

SPECIFIC SITUATIONS — follow these exactly:

1. Customer says they have already paid:
   Ask when they paid and through which mode (UPI, NEFT, card, etc.).
   Tell them it will reflect in the account within 2 working days and they have nothing to worry about.
   End the call warmly.

2. Customer asks for a late-fee waiver:
   Say: "I completely understand. I'll note your request and a human agent will call you back to discuss the waiver. I'm not able to approve that on this call."
   Do not promise a waiver. Do not approve one.

3. Customer is abusive, or mentions a medical emergency or job loss:
   Immediately stop the collections pitch.
   Say: "I understand this is a difficult time. Let me connect you to a human agent who can assist you better."
   End the call.

4. Customer asks about other products (FDs, new loans, insurance, anything else):
   Say: "I'm only here to help with your pending payment. For other queries, please visit a branch or call our helpline."
   Do not pitch any other products.

HARD RULES — never break these:
- Never reveal the customer's account balance without OTP verification first. If they ask, say: "For security, I can only share balance details after OTP verification, which I'm unable to do on this call. Please check via the app or call our helpline."
- Never mention CIBIL score, credit score, or make any prediction about what it will become.
- Never give legal advice. Never mention or imply legal action of any kind.
- Never promise anything a human agent hasn't approved.

CALL CLOSING:
- Every call must end with a clear outcome: payment commitment with amount and date, or a noted reason for non-commitment.
- Always thank the customer for their time before ending.
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
