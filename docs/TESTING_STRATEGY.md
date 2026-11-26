# Testing Strategy & Verification

## Automated Test Suites
1. **Shared Domain Logic (`packages/shared`)**:
   - Vitest unit tests verifying RBAC permission resolution and the 17-state asset lifecycle transition guards (`npm --workspace=packages/shared run test`).
2. **Backend Integration & Security (`apps/api`)**:
   - Supertest + real PostgreSQL migrations (in-memory PGlite) exercising registration, email verification, login, SSRF rejection, Zip Slip archive rejection, cross-tenant IDOR prevention, header spoofing rejection, self-verification prevention, publication gates, buyer requirement matching, inquiry-to-deal conversion, dual-signed agreements, server-side commission math, Razorpay webhook signature rejection, manual settlement, handover confirmation, and admin analytics (`npm --workspace=apps/api run test`).
3. **Python AI Analyzer (`services/ai-analyzer`)**:
   - Pytest unit tests verifying Python AST dangerous call detection (`eval`), AWS secret key detection/redaction, manifest dependency parsing, commercial revival scoring assumptions, and explainable buyer-asset matching (`pytest`).
4. **Frontend (`apps/web`)**:
   - TypeScript strict check, Vitest helper tests, and full Next.js production build verification (`npm --workspace=apps/web run build`).
