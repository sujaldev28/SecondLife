# Integration Guide

## 1. GitHub / GitLab / Bitbucket (`apps/api/src/services/repo-provider.service.ts`)
- Official REST APIs are queried over HTTPS with 8-second timeouts and strict SSRF URL validation (`validateSafeExternalUrl`).
- Configure `GITHUB_TOKEN`, `GITLAB_TOKEN`, or `BITBUCKET_TOKEN` to increase rate limits and access authorized repositories.

## 2. Razorpay (`apps/api/src/services/payment.service.ts`)
- Implemented behind `PaymentProvider` interface (`RazorpayPaymentProvider` and `ManualInvoiceSettlementProvider`).
- Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
- Register webhook URL `https://<api-domain>/api/v1/payments/webhooks/razorpay` for `payment.captured` events.
- Note on Marketplace Splits: Without an approved Razorpay Route split-settlement arrangement, SecondLife tracks invoice settlement and manual payout reconciliation explicitly rather than holding or splitting third-party funds unauthorized.

## 3. Google OAuth 2.0 / OpenID Connect (`apps/api/src/services/google-oauth.service.ts`)
- Implements official OAuth 2.0 Authorization Code flow with PKCE (`S256`), single-use server-side `oauth_states` (`state` + `nonce`), and JWKS RS256 verification of Google `id_token` via `jose` (`iss`, `aud`, `exp`, `nonce`, and `email_verified`).
- **Google Cloud Console Setup**:
  1. Open Google Cloud Console → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** (**Web application**).
  2. Add Authorized JavaScript origins: `http://localhost:3000` (and your production `APP_URL`).
  3. Add Authorized redirect URIs: `http://localhost:4000/api/v1/auth/google/callback` (and `https://<api-domain>/api/v1/auth/google/callback`).
  4. Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` in `.env` (never expose client secret in `NEXT_PUBLIC_*`).

## 4. Email Delivery (`apps/api/src/services/email.service.ts`)
- Development uses `EMAIL_DRIVER=console`. Set `EMAIL_DRIVER=smtp` with SMTP host/credentials for production transactional email delivery.
