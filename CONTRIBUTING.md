# Contributing to SecondLife

Thank you for your interest in improving **SecondLife** — an AI-assisted digital asset discovery, evaluation, ownership verification, and commercialization platform.

## 1. Project Overview

SecondLife is a multi-service monorepo:
- `packages/shared` — Shared RBAC permission matrix (`12` roles), `17`-state asset lifecycle machine, and Zod validation schemas.
- `apps/api` — Node.js + Express REST API (`v1`), Drizzle ORM (PostgreSQL / PGlite), JWT/cookie auth, Google OAuth 2.0/OIDC, OpenAPI docs.
- `apps/web` — Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 frontend.
- `services/ai-analyzer` — Isolated Python FastAPI service for static AST inspection, secret/risk scanning, manifest extraction, and commercial revival modeling.

## 2. Local Development Setup

### Prerequisites
- Node.js `>= 20.0.0` and npm `>= 10.0.0`
- Python `3.12+` (optional for running `services/ai-analyzer` locally; `apps/api` includes a deterministic fallback when offline)

### Install & Bootstrap

```bash
git clone https://github.com/sujaldev28/SecondLife.git
cd SecondLife
cp .env.example .env
npm install
npm --workspace=packages/shared run build
```

Optional Python virtual environment for `services/ai-analyzer`:

```bash
cd services/ai-analyzer
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS / Linux:      source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

Start development services:

```bash
npm run dev:api   # http://localhost:4000 (auto-applies migrations & local PGlite seed)
npm run dev:web   # http://localhost:3000
```

## 3. Branch & Commit Conventions

- **Branch naming:**
  - `feat/<short-description>` — New features or endpoints
  - `fix/<short-description>` — Bug fixes
  - `docs/<short-description>` — Documentation or repository guides
  - `chore/<short-description>` — Tooling, CI, or maintenance
  - `security/<short-description>` — Security hardening fixes (coordinate private disclosure for vulnerabilities)
- **Commit messages:** Follow Conventional Commits style (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`), keeping the subject imperative and concise.

## 4. Code Quality & Architecture Expectations

- **Shared domain contracts:** Keep roles, permissions, lifecycle states, and shared Zod schemas in `packages/shared`.
- **Tenant & permission enforcement:** Every protected API endpoint must resolve user permissions and organization membership server-side (`requireAuth` / RBAC / object-level ownership checks). Never trust client-supplied `organizationId` or fee calculations.
- **Static analysis safety:** Never execute untrusted user-uploaded archives or repositories inside `apps/api` or `services/ai-analyzer`.
- **Clean TypeScript & Python:** Avoid duplicating logic, keep modules focused, and maintain strict TypeScript (`tsc --noEmit`) without suppressing errors.
- **No secrets in git:** Never commit `.env` files, real tokens, API keys, or private personal information.

## 5. Testing & Verification Requirements

Run all checks locally before opening a pull request:

```bash
npm run typecheck
npm run build
npm test
cd services/ai-analyzer && pytest -v
```

When modifying API routes, schemas, or UI workflows, add or update corresponding Vitest / Supertest / pytest tests.

## 6. Documentation Requirements

- Update relevant documentation under `docs/` or `README.md` when changing API routes, environment variables (`.env.example`), database schema, or deployment configuration (`vercel.json`, `docker-compose.yml`).
- Never document planned features as already operational.

## 7. Pull Request Process

1. Fork the repository and create a branch from `main`.
2. Make focused, well-tested commits.
3. Verify `typecheck`, `build`, `npm test`, and `pytest` pass cleanly.
4. Fill out [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) clearly, including test evidence and security considerations.

## 8. Security Reporting

Please do **not** open public GitHub issues for security vulnerabilities. Follow [SECURITY.md](SECURITY.md) instead.
