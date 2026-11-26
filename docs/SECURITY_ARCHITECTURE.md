# Security Architecture

## Implemented Controls
1. **Authentication & Session Hygiene**:
   - Passwords hashed with `bcryptjs` (configurable `BCRYPT_ROUNDS`).
   - Short-lived JWT access tokens + rotating SHA-256 hashed refresh tokens stored in `sessions` table with revocation support (`POST /auth/logout`, `DELETE /auth/sessions/:id`, automatic session revocation on password reset).
   - HttpOnly, SameSite=Lax cookies (`COOKIE_SECURE=true` in production HTTPS).
2. **RBAC & Multi-Tenant Isolation**:
   - 12 roles mapped to granular permissions in `packages/shared/src/roles.ts`.
   - `requireAuth` resolves organization membership from `organization_members` in PostgreSQL; spoofed `x-organization-id` headers are rejected with `403 FORBIDDEN`.
   - Object-level authorization on assets, verification decisions, deal rooms, offers, agreements, and confidential risk findings.
3. **Untrusted Repository & Archive Hardening**:
   - `validateSafeExternalUrl` restricts repository URLs to `https://` and blocks loopback, private RFC1918, link-local (`169.254.x.x`), `.local`, and `.internal` hosts to prevent SSRF.
   - `inspectSafeZipArchive` checks both parsed and raw ZIP entry headers against Zip Slip (`..`), validates magic bytes, caps entry counts and uncompressed sizes against zip bombs, and never executes submitted code.
4. **Payment & Webhook Security**:
   - Transaction gross amounts, commission basis points, and net payouts are computed strictly server-side from `deals` and `system_settings`.
   - Razorpay payment signatures and raw-body webhooks are verified via constant-time HMAC-SHA256 (`timingSafeEqualStr`).
5. **HTTP & API Hardening**:
   - `helmet` security headers, strict CORS allowlist, `express-rate-limit` on `/api/v1/auth` and `/api/v1`, Pino log redaction of tokens/passwords/cookies, and `multer@2.x` for multipart uploads.
