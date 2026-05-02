#!/bin/bash
# Production entrypoint — starts both the API server and the voice agent worker
# in the same container so they are always co-located.

set -e

# ── Voice Agent Worker (background, auto-restart on crash) ───────────────────
_run_worker() {
  while true; do
    echo "[start.sh] Starting voice agent worker..."
    HEALTH_PORT=8090 API_BASE_URL=http://localhost:8080 \
      python3 artifacts/voice-agent-worker/agent.py start || true
    echo "[start.sh] Worker exited — restarting in 5s..."
    sleep 5
  done
}
_run_worker &

# ── API Server (foreground — its exit is the container exit) ─────────────────
echo "[start.sh] Starting API server on port ${PORT}..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
