#!/bin/bash
# Production entrypoint — starts both the API server and the voice agent worker
# in the same container so they are always co-located.

set -e

# ── Python dependencies (install if not already present) ─────────────────────
echo "[start.sh] Installing voice agent Python dependencies..."
python3 -m pip install -q -r artifacts/voice-agent-worker/requirements.txt \
  && echo "[start.sh] Python dependencies ready." \
  || echo "[start.sh] WARNING: pip install had errors — worker may still run if already installed."

# ── Voice Agent Worker (background, auto-restart on crash) ───────────────────
# IMPORTANT: cd into the worker directory before launching so that sys.argv[0]
# is a simple filename ("agent.py").  The livekit forkserver process re-execs
# the script by that path — if it's relative from a different CWD it crashes.
WORKER_DIR="$(pwd)/artifacts/voice-agent-worker"

_run_worker() {
  while true; do
    echo "[start.sh] Starting voice agent worker (agent_name=mumbai-bank-collector)..."
    (
      cd "$WORKER_DIR"
      HEALTH_PORT=8090 API_BASE_URL=http://localhost:8080 PYTHONUNBUFFERED=1 \
        python3 -u agent.py start 2>&1
    ) | sed -u 's/^/[worker] /' || true
    echo "[start.sh] Worker exited — restarting in 5s..."
    sleep 5
  done
}
_run_worker &

# ── API Server (foreground — its exit is the container exit) ─────────────────
echo "[start.sh] Starting API server on port ${PORT}..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
