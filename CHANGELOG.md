# Changelog

All notable changes to the **SecondLife** repository are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Google OAuth 2.0 / OpenID Connect login (`PKCE`, single-use `oauth_states`, JWKS RS256 verification via `jose`) and 5 gated fictional demo accounts (`oauth_accounts` and `oauth_states` tables, expanding the schema to 45 Drizzle `pgTable` definitions and 12 RBAC roles including `developer`).
- Multi-service Vercel deployment configuration (`vercel.json`) routing `/(.*)` to `apps/web`, `/api/(.*)` to `apps/api`, and binding `apps/api` to internal `services/ai-analyzer` via `AI_ANALYZER_URL`, plus serverless entrypoint (`apps/api/src/index.ts`) and Vercel-aware CORS/CSRF/origin resolution.
- Linux x64 native optional dependencies (`lightningcss-linux-x64-gnu`, `@tailwindcss/oxide-linux-x64-gnu`, `@next/swc-linux-x64-gnu`, `@img/sharp-linux-x64`) in `package-lock.json` and `[project].dependencies` in `services/ai-analyzer/pyproject.toml`.
- GitHub community & developer-experience suite: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.editorconfig`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`, `.github/workflows/ci.yml`, branding/diagram SVGs under `docs/assets/`, and expanded `README.md`.

### Changed
- Synchronized documentation counts (`12` RBAC roles, `45` PostgreSQL tables, `54` Next.js production build routes) across `docs/`.

## [1.0.0] — 2026-11-26

### Added
- Initial implementation of core SecondLife modules across `packages/shared`, `apps/api`, `services/ai-analyzer`, and `apps/web`.
- PostgreSQL schema with Drizzle ORM migrations and development seed data.
- Security controls: JWT/cookie session rotation, granular RBAC, tenant isolation, SSRF protection, Zip Slip & zip-bomb archive inspection, server-side commission calculation, and Razorpay HMAC webhook verification.
- Technical & product documentation suite under `docs/` and container deployment setup (`docker-compose.yml`).
