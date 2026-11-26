# Database Design

## Engine & Migrations
- **Dialect**: PostgreSQL (via `pg` `node-postgres` in production, `@electric-sql/pglite` for zero-dependency local dev and Vitest integration suites).
- **ORM & Migrations**: Drizzle ORM (`apps/api/src/db/schema.ts`) with SQL migrations in `apps/api/src/db/migrations/0000_natural_calypso.sql` and runner `apps/api/src/db/migrate.ts`.

## Schema Inventory (43 Normalized Tables)
- **Identity & Multi-Tenancy**: `users`, `sessions`, `email_tokens`, `organizations`, `organization_members`, `organization_invitations`, `workspaces`, `subscription_plans`, `subscriptions`.
- **Asset Discovery & Registry**: `asset_categories`, `assets`, `asset_versions`, `repositories`, `asset_metadata`, `asset_history`, `discovery_candidates`.
- **Ownership & Compliance**: `ownership_records`, `contributors`, `licenses`, `verification_requests`, `verification_evidence`, `disputes`.
- **AI Intelligence**: `analysis_jobs`, `technical_reports`, `risk_findings`, `commercial_reports`.
- **Marketplace & Matching**: `marketplace_listings`, `saved_assets`, `buyer_requirements`, `asset_matches`.
- **Collaboration & Deals**: `inquiries`, `conversations`, `messages`, `deals`, `offers`, `agreements`.
- **Transactions & Handover**: `transactions`, `payments`, `refunds`, `asset_handovers`.
- **Governance**: `notifications`, `audit_logs`, `system_settings`.

## Tenant Isolation Controls
- Every tenant-owned asset, workspace, deal, and transaction links to `organization_id` via foreign keys.
- API middleware (`apps/api/src/middleware/auth.ts`) resolves `organizationMembers` from the database before authorizing any request, rejecting forged `x-organization-id` headers with `403 FORBIDDEN`.
