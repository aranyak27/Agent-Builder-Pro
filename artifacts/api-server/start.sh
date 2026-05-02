#!/bin/bash
# Production entrypoint — starts both the API server and the voice agent worker
# in the same container so they are always co-located.

# ── Python dependencies ───────────────────────────────────────────────────────
# Deps are installed at BUILD time (see artifact.toml services.production.build)
# so cold starts skip ~30s of pip install. We only verify at runtime as a
# safety net in case someone deploys without rebuilding.
if ! python3 -c "import livekit.agents, deepgram, openai" >/dev/null 2>&1; then
  echo "[start.sh] Voice agent Python deps missing — installing now (slow path)..."
  python3 -m pip install -q -r artifacts/voice-agent-worker/requirements.txt
fi

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
