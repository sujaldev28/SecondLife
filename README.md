# SecondLife — Digital Asset Commercialization Platform

**Tagline:** Give Abandoned Digital Assets a Second Life.

SecondLife is an AI-powered digital asset discovery, technical evaluation, ownership verification, and commercialization platform connecting digital asset owners with buyers, developers, startups, and enterprise engineering organizations.

## Monorepo Structure
- `packages/shared`: Shared RBAC permission matrix, 17-state asset lifecycle machine, Zod schemas.
- `apps/api`: Node.js + Express + TypeScript REST API (`v1`), Drizzle ORM (PostgreSQL / PGlite), OpenAPI (`/api-docs`).
- `apps/web`: Next.js 16 + React 19 + TypeScript + Tailwind CSS frontend (public site, auth, Owner, Buyer, Deal Room, Admin consoles).
- `services/ai-analyzer`: Isolated Python FastAPI service for static AST, secret, dependency, and commercial revival analysis.
- `docs/`: Complete product, architecture, database, security, testing, and deployment documentation.

## Quick Start (Local Development)
1. Copy `.env.example` to `.env`.
2. Install JS dependencies: `npm install`
3. Build shared package: `npm --workspace=packages/shared run build`
4. Run API (auto-applies PostgreSQL migrations & seeds dev data via PGlite): `npm run dev:api`
5. Run Web frontend: `npm run dev:web`
6. (Optional) Run isolated Python AI service: `cd services/ai-analyzer && pip install -r requirements.txt && uvicorn app.main:app --port 8000`

## Verification Commands
- `npm test` — Runs `packages/shared`, `apps/api` integration/security tests, and `apps/web` tests.
- `npm run build` — Builds `packages/shared`, `apps/api`, and `apps/web`.
- `cd services/ai-analyzer && pytest` — Runs Python static & commercial analyzer tests.
