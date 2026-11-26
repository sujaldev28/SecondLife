# Changelog

## 1.0.0 — 2026-11-26
- Initial production-grade implementation of all 10 SecondLife core modules across `packages/shared`, `apps/api`, `services/ai-analyzer`, and `apps/web`.
- Normalized 43-table PostgreSQL schema with Drizzle migrations and development seed data.
- Implemented security controls: JWT/cookie session rotation, 11-role granular RBAC, tenant isolation, SSRF protection, Zip Slip & zip-bomb archive inspection, server-side commission calculation, and Razorpay HMAC webhook verification.
- Created full documentation suite under `docs/` and container deployment setup (`docker-compose.yml`).
