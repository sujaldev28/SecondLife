# Deployment Guide

## Production Topology (`vercel.json` Multi-Service Deployment)
SecondLife deploys as a single Vercel project using Vercel Services (`vercel.json` at the repository root):
- **`web`** (`apps/web`, Next.js): Public catch-all frontend routed on `/(.*)`. Calls `/api/v1/*` on the same Vercel domain.
- **`api`** (`apps/api`, Express): Public backend API routed on `/api/(.*)` (`src/index.ts` entrypoint). Uses a Vercel service binding (`AI_ANALYZER_URL`) to call `ai-analyzer`.
- **`ai-analyzer`** (`services/ai-analyzer`, FastAPI): Internal-only Python service (`app.main:app` entrypoint) with no public rewrite; reachable solely from `api` via Vercel's service binding (`X-Internal-Token` authenticated).

### Vercel Deployment Notes
1. Configure a managed PostgreSQL database (`DATABASE_URL=postgresql://...`) and set required secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_TOKEN`, `NODE_ENV=production`, `COOKIE_SECURE=true`) in Vercel Project Environment Variables.
2. Do **not** set `AI_ANALYZER_URL` manually in Vercel or `.env` — Vercel injects it automatically into `api` at runtime from the service binding in `vercel.json`.
3. Do **not** set `NEXT_PUBLIC_API_URL` to a `localhost` URL on Vercel; omitting it allows the frontend to use same-origin `/api/v1` routing automatically.
4. For local multi-service development with bindings active, run `vercel dev` from the repository root.

## Alternative Topology (`docker-compose.yml`)
- **postgres**: PostgreSQL 16 (`pg_isready` healthchecked, persistent volume).
- **redis**: Redis 7 (rate limiting/queue coordination).
- **ai-analyzer**: Isolated Python FastAPI service (`services/ai-analyzer`) on internal network.
- **api**: Node.js Express API (`apps/api`) running `node dist/server.js` after migrations.
- **web**: Next.js standalone/production server (`apps/web`).

## Pre-Launch Steps
1. Copy `.env.example` to `.env` for local development, and provision non-default `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_TOKEN`, and managed `DATABASE_URL` in production.
2. Set `NODE_ENV=production` and `COOKIE_SECURE=true` behind TLS termination.
3. Run database migrations (`npm --workspace=apps/api run db:migrate`) and category/plan/settings seed (`npm --workspace=apps/api run db:seed` — automatically skips demo users/assets when `NODE_ENV=production`). On Vercel serverless cold starts, `apps/api/src/index.ts` also ensures idempotent migrations and baseline catalog/plan records before serving requests.
4. Configure automated PostgreSQL `pg_dump` backups and S3-compatible object storage for uploaded archives.
5. Rollback procedure: retain previous Vercel deployment / container image tags and apply backward-compatible SQL migrations before routing traffic.
