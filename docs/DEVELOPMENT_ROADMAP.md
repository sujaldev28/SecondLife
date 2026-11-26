# Phase 0 Audit, Implementation Roadmap & Risk Register

## 1. Phase 0 — Initial Repository & Environment Audit

### Repository Tree (Initial State)
- `c:\Users\sujal\Desktop\SecondLife` initialized as an empty directory (no existing code, schemas, dependencies, or git history).
- Fresh Git repository initialized (`git init`).

### Local Host Runtime Audit
- **Node.js**: `v22.14.0` (verified)
- **npm**: `10.9.2` (verified)
- **Python**: `3.13.14` (verified)
- **Docker / local `psql`**: Not installed on the host machine.

### Architectural Decision on Database & Persistence
- **Production Primary Database**: PostgreSQL 16+ via `pg` (`node-postgres`) + Drizzle ORM.
- **Local Development & Automated Test Database**: `@electric-sql/pglite` (in-process PostgreSQL engine persisted to `.data/pglite` or in-memory for tests) using the **exact same PostgreSQL SQL dialect, Drizzle `pgTable` schema, enums, JSONB columns, foreign keys, indexes, and SQL migrations**.
- **Rationale**: Eliminates fake in-memory mocks and avoids SQLite dialect drift while enabling genuine PostgreSQL persistence and migrations locally without requiring local Docker/PostgreSQL daemon installation. Switching to managed PostgreSQL in production requires only changing `DATABASE_URL` to `postgresql://...`.

### Security & Technical Risk Register
| Risk ID | Risk Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| R-01 | Untrusted archive uploads (Zip Slip, Zip Bomb, malware, oversized payloads) | Critical | Enforce size/entry/compression-ratio limits, canonical path validation, MIME/extension checks, never execute submitted code on app server, isolated Python static analyzer |
| R-02 | Cross-tenant IDOR / unauthorized report or private asset access | Critical | Server-side session & membership resolution, organization-scoped queries, object-level authorization middleware, never trust client `organizationId` |
| R-03 | Payment amount tampering & forged webhooks | Critical | Server-side fee/commission calculation from DB configuration, Razorpay HMAC-SHA256 webhook signature verification, idempotency keys |
| R-04 | Unverified ownership claims / IP & open-source license conflicts | High | Mandatory ownership declaration, evidence vault, automated license detection, explicit legal review & verification gates prior to marketplace publication |
| R-05 | SSRF via submitted repository URLs | High | Strict HTTPS allowlist, block private/loopback/link-local IP ranges, URL validation before outbound API requests |
| R-06 | Prompt injection in analyzed source code / READMEs | Medium | Separate deterministic AST/SCA/secret analysis from optional LLM summarization; treat repository text strictly as untrusted data |

---

## 2. Phased Implementation Roadmap & Accountability Tracker

- **Phase 0 — Audit & Architecture**: Complete (this document + baseline docs + monorepo scaffolding).
- **Phase 1 — Foundation**: `packages/shared`, `apps/api` (Express + Drizzle Postgres/PGlite + migrations + JWT/cookie auth + RBAC + org/workspace management + audit logs + error handling + structured logging), `apps/web` (Next.js + Tailwind + design system + auth pages), Phase 1 tests.
- **Phase 2 — Asset Lifecycle**: Asset submission, archive upload & safe extraction, GitHub/GitLab/Bitbucket provider adapter, discovery candidate engine, asset registry, versioning, lifecycle state machine, ownership declarations & verification workflow.
- **Phase 3 — AI Intelligence**: Python FastAPI `services/ai-analyzer` (tree/AST parsing, language & stack detection, static quality/maintainability indicators, secret scanner, dependency & OSV vulnerability checks, deterministic + ML commercial valuation engine with confidence & assumptions) + Node job queue integration + explainable Technical & Commercial Reports.
- **Phase 4 — Marketplace**: Public & authenticated marketplace, full-text & multi-facet search/filters, asset comparison, saved assets, buyer requirements, explainable matching & recommendations.
- **Phase 5 — Collaboration & Transactions**: Inquiries, conversations & secure messaging, due diligence requests, offers & negotiations, commercial agreements, configurable commission/pricing engine, Razorpay-ready payment adapter + webhook verification + compliant manual settlement fallback, asset handover & receipt confirmation.
- **Phase 6 — Administration & Governance**: Admin control center (users, organizations, verification queue, marketplace moderation, transactions, disputes, platform analytics, AI job monitoring, security/audit logs, system settings).
- **Phase 7 — Production Readiness**: Full regression tests, OWASP-focused security tests, Docker Compose & deployment guides, backup/recovery scripts, complete documentation synchronization.
