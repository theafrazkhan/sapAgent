# FastAPI service boundary

The current revision introduces an actual FastAPI service (`backend/main.py`) and Swagger UI at `/backend/docs` through the frontend reverse proxy. It is an API boundary over existing Node application services, not a claim that the SQL engine and import parsers have already been rewritten in Python. Keeping those services authoritative preserves the current schema, tenant RLS, validated imports and dashboard/agent agreement.

The agent calls FastAPI `/tools/execute` over HTTP, forwarding the authenticated session. FastAPI forwards the session to the existing service; scope is resolved from the session on every request. The model cannot supply a tenant identity. Node validates strict tool arguments, authorization, snapshot ownership and output limits. Swagger documents the transport and `/tools` returns the exact strict JSON tool definitions.

Frontend: `npm run dev`. API: create `.venv`, install `backend/requirements.txt`, then `npm run dev:api`. The frontend rewrites `/backend/*` to FASTAPI_URL. Both services must run for chat. Python settings are loaded from ignored `.env.local` by `scripts/backend-dev.py`. Production must use the same APP_URL on both processes and a private service network.

Local Neon connectivity can use a development-only SSH forward on DATABASE_TUNNEL_PORT. TLS server identity still matches the original Neon hostname. Production ignores that setting and uses DATABASE_URL directly. The tunnel must be running; it is not durable deployment infrastructure.

## Remaining migration boundary

Imports, login/session handling, SQL queries, file retrieval and model orchestration still reside in Node. FastAPI currently publishes dashboard, records, order details and tool endpoints. A complete Python backend migration needs parity tests and a rollout; do not present this service adapter as that completed migration.
