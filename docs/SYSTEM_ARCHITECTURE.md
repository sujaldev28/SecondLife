# System Architecture

## Monorepo Topology
- `packages/shared`: Shared TypeScript RBAC permission matrix (`ROLE_PERMISSIONS`), 17-state asset lifecycle state machine, and Zod validation schemas.
- `apps/api`: Node.js + Express + TypeScript modular monolith REST API (`v1`) using Drizzle ORM (PostgreSQL in production, PGlite in local dev/test), Pino structured logging, Helmet, CORS, rate limiting, and Swagger OpenAPI (`/api-docs`).
- `services/ai-analyzer`: Isolated Python 3 FastAPI service performing static Python AST parsing, JS/TS security checks, secret scanning, dependency extraction, commercial revival modeling, and buyer-asset matching.
- `apps/web`: Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4 frontend serving 13 public pages, 6 auth pages, Owner Console (11 pages), Buyer Console (10 pages), Deal Room, and Admin Console (12 pages).

## Trust & Isolation Boundaries
- Untrusted uploaded archives are validated in memory (`inspectSafeZipArchive`) without ever executing submitted code on the Node API server.
- Communication between `apps/api` and `services/ai-analyzer` is authenticated via `X-Internal-Token` (`INTERNAL_SERVICE_TOKEN`).
- If `services/ai-analyzer` is offline, `apps/api` falls back to a deterministic static scanner and explicitly marks `engineMode: 'deterministic_node_fallback'` and records the limitation in `technical_reports.known_limitations`.
