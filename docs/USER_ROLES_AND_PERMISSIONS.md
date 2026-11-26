# User Roles & Granular Permissions

Implemented in `packages/shared/src/roles.ts` and enforced server-side in `apps/api/src/middleware/auth.ts`.

## Roles (12)
1. `individual_owner` — Individual digital asset owner permissions (`asset:*`, `analysis:*`, `verification:submit`, `deal:*`, `handover:deliver`).
2. `asset_owner` — Dedicated asset portfolio owner permissions.
3. `buyer` — Marketplace browsing, saving, comparing, requirement definition, inquiry/offer negotiation, agreement signing, payment initiation, handover receipt confirmation.
4. `developer` — Asset creation/updates (`asset:create`, `asset:read_own`, `asset:update_own`), static analysis triggering/reading, marketplace browsing/comparison, and deal participation.
5. `enterprise_member` — Combined owner/buyer workspace permissions plus confidential technical risk report access.
6. `org_admin` — Organization management, invitations, workspace creation, audit log access, plus owner/buyer capabilities.
7. `org_owner` — Full organization administration including subscription management.
8. `evaluator` — Trigger analysis, view confidential reports, record documented commercial overrides, monitor AI jobs.
9. `verification_specialist` — Review verification queues, approve/reject ownership claims, resolve disputes.
10. `deal_manager` — Cross-deal oversight and transaction monitoring.
11. `platform_admin` — User/org governance, marketplace moderation, refunds, analytics, system settings, security audit logs.
12. `super_admin` — Full platform permission set (`PERMISSIONS`).
