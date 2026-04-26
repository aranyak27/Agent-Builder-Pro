# Workspace

## Overview

pnpm workspace monorepo using TypeScript + Python. Contains a full-stack voice agent platform powered by LiveKit.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Python**: 3.11 (for the voice agent worker)

## Voice Agent Architecture

### Services

| Service | Location | Description |
|---------|----------|-------------|
| API Server | `artifacts/api-server` | Express 5 REST API — token generation, session history, webhook handler |
| Voice Agent Frontend | `artifacts/voice-agent` | React + Vite UI — join calls, view transcripts, stats dashboard |
| Voice Agent Worker | `artifacts/voice-agent-worker` | Python — LiveKit agent process (Deepgram STT → OpenAI LLM → Cartesia TTS) |

### Voice Stack

- **Real-time infra**: LiveKit Cloud (`wss://voiceaiaranyak-z4qcxrcz.livekit.cloud`)
- **STT**: Deepgram
- **LLM**: OpenAI (via Replit AI Integrations proxy)
- **TTS**: Cartesia

### API Endpoints

- `POST /api/voice/token` — Generate LiveKit access token for a room
- `GET /api/voice/sessions` — List all voice sessions
- `GET /api/voice/sessions/:id` — Get session details
- `GET /api/voice/sessions/:id/messages` — Get transcript messages
- `GET /api/voice/stats` — Aggregate statistics
- `POST /api/voice/webhook` — LiveKit webhook (room events)

### Environment Variables / Secrets

| Key | Description |
|-----|-------------|
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key (secret) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (secret) |
| `DEEPGRAM_API_KEY` | Deepgram STT API key (secret) |
| `CARTESIA_API_KEY` | Cartesia TTS API key (secret) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI proxy URL (auto-set) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI proxy key (auto-set) |

### Agent Configuration

The voice agent system prompt and behavior are configured in:
`artifacts/voice-agent-worker/agent.py` → `SYSTEM_PROMPT` constant

### Starting the Voice Agent Worker

The worker is configured as the "Voice Agent Worker" workflow. Start it from the Replit workflows panel, or run:
```
python3 artifacts/voice-agent-worker/agent.py dev
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- After codegen: `echo 'export * from "./generated/api";' > lib/api-zod/src/index.ts` (fix re-export conflict)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `voice_sessions` — one row per LiveKit room/call session
- `voice_messages` — transcript messages (user + assistant turns per session)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
