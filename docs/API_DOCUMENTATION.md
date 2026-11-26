# API Documentation

Interactive OpenAPI 3.0 documentation is served at `GET /api-docs` and JSON schema at `GET /api/v1/openapi.json`.

## Base Path
`/api/v1`

## Key Endpoint Groups
- **Auth**: `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`, `PATCH /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/deactivate`.
- **Organizations & Workspaces**: `GET/POST /organizations`, `POST /organizations/switch`, `GET /organizations/:orgId/members`, `POST /organizations/:orgId/invitations`, `POST /organizations/invitations/accept`, `PATCH /organizations/:orgId/members/:memberId/role`, `GET/POST /organizations/:orgId/workspaces`, `GET /organizations/:orgId/audit-logs`, `GET /subscriptions/plans`, `GET/POST /organizations/:orgId/subscription`.
- **Assets & Discovery**: `GET /categories`, `GET/POST /assets`, `GET /assets/:id`, `POST /assets/:id/upload-archive`, `POST /assets/:id/sync-repository`, `POST /assets/:id/transition`, `GET /discovery/candidates`, `POST /discovery/scan`, `POST /discovery/candidates/:id/import`.
- **Verification & Disputes**: `POST /assets/:id/ownership-declaration`, `GET /assets/:id/verification`, `GET /verification/queue`, `POST /verification/:requestId/decision`, `POST /assets/:id/disputes`, `GET /disputes`, `POST /disputes/:id/resolve`.
- **AI Analysis**: `POST /assets/:id/analyze`, `GET /assets/:id/reports`, `POST /reports/:commercialReportId/override`.
- **Marketplace**: `GET /marketplace/listings`, `GET /marketplace/listings/:id`, `GET /marketplace/compare`, `POST /assets/:id/publish-listing`, `GET/POST/DELETE /saved-assets`, `GET/POST /buyer/requirements`, `GET /buyer/recommendations`.
- **Deals & Transactions**: `POST/GET /inquiries`, `POST /inquiries/:id/respond`, `GET /deals`, `GET /deals/:id`, `POST /deals/:id/messages`, `POST /deals/:id/offers`, `POST /offers/:offerId/respond`, `POST /deals/:id/agreements`, `POST /agreements/:agreementId/sign`, `POST /deals/:id/transactions/initiate`, `POST /transactions/:id/verify-razorpay`, `POST /payments/webhooks/razorpay`, `POST /transactions/:id/confirm-settlement`, `POST /transactions/:id/refund`, `GET /transactions`, `POST /deals/:id/handover/deliver`, `POST /deals/:id/handover/confirm`.
- **Admin**: `GET /admin/overview`, `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/organizations`, `GET /admin/assets`, `GET /admin/marketplace`, `POST /admin/marketplace/:listingId/moderate`, `GET /admin/ai-jobs`, `GET /admin/security-events`, `GET /admin/settings`, `PUT /admin/settings/:key`.
