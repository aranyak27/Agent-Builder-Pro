"""
Voice Agent Worker  — Mumbai Bank Collections Agent (v1 prompt)
===============================================================
LiveKit Agents v1.x using:
- Deepgram  — Speech-to-Text (STT) + Text-to-Speech (TTS)
- OpenAI    — Language Model (LLM) via Replit AI proxy
- Silero    — Voice Activity Detection (VAD)

Usage:
  python3 agent.py start    # production mode (wait for dispatch)
  python3 agent.py dev      # development mode (file watching / hot reload)
"""

import asyncio
import os
import logging
import threading
import aiohttp
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Annotated
from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import deepgram, openai as lk_openai, silero

logger = logging.getLogger("voice-agent")



# Internal API base — always localhost (co-located with API server in both dev and prod)
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8080")


def _start_health_server(port: int) -> None:
    """Minimal HTTP server so Replit knows this worker is alive in production."""
    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok","service":"voice-agent-worker"}')
        def log_message(self, *_):
            pass

    srv = HTTPServer(("", port), _Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    logger.info(f"Health server started on port {port}")


# NOTE: health server is started inside __main__ only — NOT here at module level.
# When forkserver spawns a subprocess to handle a call it re-imports this file;
# if the health server bind ran here, the subprocess would try to bind the same
# port as the main process → OSError: Address already in use → call crash.


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

CALL OUTCOME — MANDATORY:
Before ending every call, you MUST call the capture_call_outcome tool with the structured result.
Use the outcome type that best describes how the call ended:
- promise_to_pay: customer committed to paying. Fields: amount, payment_date.
- already_paid: customer says they already paid. Fields: payment_mode, payment_date.
- callback_request: customer asked for a callback. Fields: callback_time.
- dispute: customer disputes the debt or amount. Fields: reason.
- transfer_to_human: abusive, emergency, or job loss. Fields: reason.

CONFIDENCE RATING — include in every outcome capture:
Rate your confidence (0–100) that you correctly classified the outcome:
- 90–100: Customer explicitly confirmed all key details (amount + date, or payment mode + date, etc.)
- 75–89: Customer gave a clear answer but one detail was vague or inferred
- 50–74: Customer's intent was unclear, you had to infer the outcome
- 0–49: Customer hung up, was unresponsive, or the call ended without a clear resolution
Any outcome with confidence below 80 will automatically be flagged for human review.

Say a brief closing line to the customer AFTER calling the tool, then end the call.

ENDING THE CALL:
- After calling the capture_call_outcome tool, say a brief, warm closing line (e.g. "Thank you for your time. Have a good day. Goodbye.") and then stop speaking — the call will disconnect automatically.
- If the customer says "bye", "goodbye", "ok thanks", or any clear farewell, call capture_call_outcome immediately with the most appropriate outcome type, then say your closing line.
- Do not keep talking after the farewell — one short closing sentence is enough.
- This is a real-time voice call — keep all responses concise and conversational.
"""

GREETING = (
    "Hello, this is Priya calling from Mumbai Bank. "
    "Am I speaking with the account holder? "
    "I'm reaching out regarding your credit card account which has an overdue balance. "
    "Do you have a moment to discuss this?"
)


async def entrypoint(ctx: JobContext):
    """Main agent entrypoint — called for each incoming room/participant."""
    room_name = ctx.room.name
    logger.info(f"Connecting to room: {room_name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Load VAD in a thread so it never blocks the async event loop.
    # The model is pre-downloaded by start.sh so this completes in < 1s.
    vad = await asyncio.to_thread(silero.VAD.load)

    # Build the OpenAI client — uses Replit AI Integrations proxy when available
    openai_base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    openai_api_key = (
        os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
        or os.environ.get("OPENAI_API_KEY", "placeholder")
    )

    # ── Function tool: capture structured call outcome ──────────────────────
    @function_tool
    async def capture_call_outcome(
        outcome_type: Annotated[
            str,
            "The call outcome type. One of: promise_to_pay, already_paid, callback_request, dispute, transfer_to_human",
        ],
        confidence: Annotated[
            int,
            "Your confidence (0–100) that this outcome classification is correct. Below 80 triggers human review.",
        ],
        amount: Annotated[str, "Amount the customer committed to pay (for promise_to_pay)"] = "",
        payment_date: Annotated[str, "Date of payment or promised payment (for promise_to_pay or already_paid)"] = "",
        payment_mode: Annotated[str, "Payment mode used, e.g. UPI, NEFT, card (for already_paid)"] = "",
        callback_time: Annotated[str, "Preferred time for callback (for callback_request)"] = "",
        reason: Annotated[str, "Reason for dispute or transfer to human (for dispute or transfer_to_human)"] = "",
    ) -> str:
        """
        Capture the structured outcome of this collections call and send it to
        the CRM. Must be called once before ending every call. The call will
        disconnect automatically a few seconds after this tool is called.
        Outcomes with confidence below 80 are automatically flagged for human review.
        """
        confidence_clamped = max(0, min(100, confidence))
        needs_review = confidence_clamped < 80

        outcome_data: dict[str, str] = {}
        if amount:
            outcome_data["amount"] = amount
        if payment_date:
            outcome_data["payment_date"] = payment_date
        if payment_mode:
            outcome_data["payment_mode"] = payment_mode
        if callback_time:
            outcome_data["callback_time"] = callback_time
        if reason:
            outcome_data["reason"] = reason

        payload = {
            "roomName": room_name,
            "outcomeType": outcome_type,
            "outcomeData": outcome_data,
            "confidence": confidence_clamped,
            "needsReview": needs_review,
        }

        # Retry up to 3 times with exponential backoff — outcome loss is not acceptable
        for attempt in range(3):
            try:
                async with aiohttp.ClientSession() as http:
                    async with http.post(
                        f"{API_BASE}/api/voice/outcome",
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as resp:
                        result = await resp.json()
                        logger.info(
                            f"Outcome captured: {outcome_type} | confidence={confidence_clamped}% "
                            f"| needs_review={needs_review} → session {result.get('sessionId')}"
                        )
                        break  # success — stop retrying
            except Exception as e:
                wait = 2 ** attempt  # 1s, 2s, 4s
                if attempt < 2:
                    logger.warning(f"Outcome save attempt {attempt + 1} failed ({e}), retrying in {wait}s…")
                    await asyncio.sleep(wait)
                else:
                    logger.error(f"All 3 outcome save attempts failed for room {room_name}: {e}")

        # Disconnect after a short delay — gives Priya time to speak
        # the closing line before the room is torn down.
        async def _disconnect_after_closing():
            await asyncio.sleep(7)
            logger.info("Disconnecting room after call outcome")
            await ctx.room.disconnect()

        asyncio.create_task(_disconnect_after_closing())
        review_note = " This will be flagged for human review." if needs_review else ""
        return f"Outcome recorded: {outcome_type} (confidence {confidence_clamped}%).{review_note} Say your closing line now — the call will end in a few seconds."

    # ────────────────────────────────────────────────────────────────────────

    session = AgentSession(
        vad=vad,
        stt=deepgram.STT(
            model="nova-2-phonecall",
            api_key=os.environ["DEEPGRAM_API_KEY"],
            language="en-IN",
        ),
        llm=lk_openai.LLM(
            model="gpt-4o-mini",
            base_url=openai_base_url,
            api_key=openai_api_key,
        ),
        tts=deepgram.TTS(
            model="aura-2-hera-en",
            api_key=os.environ["DEEPGRAM_API_KEY"],
        ),
        allow_interruptions=True,
        min_endpointing_delay=0.5,
        min_interruption_duration=0.5,
    )

    agent = Agent(
        instructions=SYSTEM_PROMPT,
        tools=[capture_call_outcome],
    )

    # ── Transcript capture: save every user/assistant turn to the DB ─────────
    @session.on("conversation_item_added")
    def on_conversation_item_added(ev) -> None:
        item = ev.item
        # Only capture user and assistant messages (skip tool calls, system, etc.)
        if not hasattr(item, "role") or item.role not in ("user", "assistant"):
            return
        # Extract text content — ChatMessage.content is list[str | ImageContent | AudioContent | Instructions]
        # Each element may be a plain str or an object with a .text property.
        parts: list[str] = []
        for chunk in item.content:
            if isinstance(chunk, str):
                parts.append(chunk)
            elif hasattr(chunk, "text"):
                t = chunk.text
                if isinstance(t, str):
                    parts.append(t)
        text = " ".join(parts).strip()
        if not text:
            return

        async def _save_message(role: str, content: str) -> None:
            for attempt in range(3):
                try:
                    async with aiohttp.ClientSession() as http:
                        async with http.post(
                            f"{API_BASE}/api/voice/transcript",
                            json={"roomName": room_name, "role": role, "content": content},
                            timeout=aiohttp.ClientTimeout(total=5),
                        ) as resp:
                            if resp.status < 300:
                                break  # success
                            raise aiohttp.ClientError(f"HTTP {resp.status}")
                except Exception as exc:
                    if attempt < 2:
                        await asyncio.sleep(1)
                    else:
                        logger.warning(f"Transcript save failed after 3 attempts ({role}): {exc}")

        asyncio.ensure_future(_save_message(item.role, text))
    # ─────────────────────────────────────────────────────────────────────────

    await session.start(agent, room=ctx.room)

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    await session.say(GREETING, allow_interruptions=True)

    logger.info("Mumbai Bank collections agent started — Priya is live")


if __name__ == "__main__":
    import sys

    # Start health server HERE (main process only) — never at module level.
    # Forkserver re-imports this file in each subprocess; if health server ran
    # at module level the subprocess would collide on the same port → crash.
    _health_port = int(os.environ.get("HEALTH_PORT", 0))
    if _health_port:
        _start_health_server(_health_port)

    # Fix forkserver path resolution: make sys.argv[0] absolute so that when
    # forkserver re-execs this script it can always find it regardless of CWD.
    sys.argv[0] = os.path.abspath(__file__)

    # AGENT_NAME separates dev and production workers on the same LiveKit project.
    # Dev: set AGENT_NAME=mumbai-bank-collector-dev so production calls never route
    # to the dev worker.  Production start.sh leaves this unset → "mumbai-bank-collector".
    agent_name = os.environ.get("AGENT_NAME", "mumbai-bank-collector")
    logger.info(f"Starting worker as agent_name={agent_name!r}")
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=agent_name,
            port=0,  # random port — avoids conflict with proxy in both dev and production
        )
    )
