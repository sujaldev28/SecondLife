# Environment Configuration

Reference `.env.example` at the repository root.

| Variable | Purpose | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime mode (`development`, `test`, `production`) | `production` |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) or `pglite://...` | Managed PostgreSQL URI |
| `JWT_ACCESS_SECRET` | HS256 signing secret for access tokens | 32+ char CSPRNG secret |
| `JWT_REFRESH_SECRET` | HS256 signing secret for refresh tokens | 32+ char CSPRNG secret |
| `INTERNAL_SERVICE_TOKEN` | Shared auth header between `apps/api` and `services/ai-analyzer` | Strong random secret |
| `COOKIE_SECURE` | Enforces HTTPS-only auth cookies | `true` |
| `DEMO_MODE_ENABLED` | Enables demo account login & Sign In page credentials (`true` in dev/staging; `false` by default in production) | `false` |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Official Google OAuth 2.0 Web Client credentials | Production OAuth Client |
| `GOOGLE_OAUTH_REDIRECT_URI` | Backend OAuth callback URL (`.../api/v1/auth/google/callback`) | `https://<api-domain>/api/v1/auth/google/callback` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Orders API credentials | Live merchant keys |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC-SHA256 verification secret for Razorpay webhooks | Live webhook secret |
| `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` | Optional API tokens for higher rate limits and authorized repos | Scoped read-only tokens |
