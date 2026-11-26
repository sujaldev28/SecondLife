# User Roles & Granular Permissions

Implemented in `packages/shared/src/roles.ts` and enforced server-side in `apps/api/src/middleware/auth.ts`.

## Roles (11)
1. `individual_owner` — Individual digital asset owner permissions (`asset:*`, `analysis:*`, `verification:submit`, `deal:*`, `handover:deliver`).
2. `asset_owner` — Dedicated asset portfolio owner permissions.
3. `buyer` — Marketplace browsing, saving, comparing, requirement definition, inquiry/offer negotiation, agreement signing, payment initiation, handover receipt confirmation.
4. `enterprise_member` — Combined owner/buyer workspace permissions plus confidential technical risk report access.
5. `org_admin` — Organization management, invitations, workspace creation, audit log access, plus owner/buyer capabilities.
6. `org_owner` — Full organization administration including subscription management.
7. `evaluator` — Trigger analysis, view confidential reports, record documented commercial overrides, monitor AI jobs.
8. `verification_specialist` — Review verification queues, approve/reject ownership claims, resolve disputes.
9. `deal_manager` — Cross-deal oversight and transaction monitoring.
10. `platform_admin` — User/org governance, marketplace moderation, refunds, analytics, system settings, security audit logs.
11. `super_admin` — Full platform permission set (`PERMISSIONS`).
