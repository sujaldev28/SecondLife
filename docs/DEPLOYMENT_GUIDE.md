# Deployment Guide

## Production Topology (`docker-compose.yml`)
- **postgres**: PostgreSQL 16 (`pg_isready` healthchecked, persistent volume).
- **redis**: Redis 7 (rate limiting/queue coordination).
- **ai-analyzer**: Isolated Python FastAPI service (`services/ai-analyzer`) on internal network.
- **api**: Node.js Express API (`apps/api`) running `node dist/server.js` after migrations.
- **web**: Next.js standalone/production server (`apps/web`).

## Pre-Launch Steps
1. Copy `.env.example` to `.env` and provision non-default `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_TOKEN`, and managed `DATABASE_URL`.
2. Set `NODE_ENV=production` and `COOKIE_SECURE=true` behind TLS termination.
3. Run database migrations (`npm --workspace=apps/api run db:migrate`) and category/plan/settings seed (`npm --workspace=apps/api run db:seed` — automatically skips demo users/assets when `NODE_ENV=production`).
4. Configure automated PostgreSQL `pg_dump` backups and S3-compatible object storage for uploaded archives.
5. Rollback procedure: retain previous container image tags and apply backward-compatible SQL migrations before routing traffic.
