#!/bin/bash
# Production entrypoint — starts both the API server and the voice agent worker
# in the same container so they are always co-located.

# ── Python dependencies ───────────────────────────────────────────────────────
echo "[start.sh] Installing voice agent Python dependencies..."
python3 -m pip install -q -r artifacts/voice-agent-worker/requirements.txt \
  && echo "[start.sh] Python dependencies ready." \
  || echo "[start.sh] WARNING: pip install had errors — worker may still run if already installed."

# ── Pre-warm silero VAD model (downloads & caches on cold start) ─────────────
# This runs synchronously before the worker starts so the model is always
# cached in .pythonlibs when the worker's entrypoint calls silero.VAD.load().
# Without this, production cold-start downloads the model inside a subprocess
# which exceeds the livekit-agents initialization timeout and kills every call.
echo "[start.sh] Pre-warming silero VAD model..."
python3 -c "from livekit.plugins import silero; silero.VAD.load(); print('[start.sh] Silero VAD model ready.')"

# ── Voice Agent Worker (background, auto-restart on crash) ───────────────────
# IMPORTANT: No sed pipe — output goes directly to the container log so nothing
# is buffered or dropped.  The livekit forkserver re-execs the script by
# sys.argv[0]; agent.py makes that path absolute via os.path.abspath(__file__).
_run_worker() {
  while true; do
    echo "[start.sh] Starting voice agent worker (agent_name=mumbai-bank-collector)..."
    HEALTH_PORT=8090 \
    API_BASE_URL=http://localhost:8080 \
    PYTHONUNBUFFERED=1 \
      python3 -u artifacts/voice-agent-worker/agent.py start
    echo "[start.sh] Worker exited (code=$?) — restarting in 5s..."
    sleep 5
  done
}
_run_worker &

# ── API Server (foreground — its exit is the container exit) ─────────────────
echo "[start.sh] Starting API server on port ${PORT}..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
