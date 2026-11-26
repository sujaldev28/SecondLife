# Functional Specification

## Compliance & Publication Gates
- **Gate 1 — Lifecycle State Machine (`packages/shared/src/lifecycle.ts`)**: Transitions are validated server-side via `assertAssetTransition(from, to)`. Arbitrary status jumps from the frontend are rejected with `400 BAD_REQUEST`.
- **Gate 2 — Marketplace Publication (`POST /api/v1/assets/:id/publish-listing`)**: An asset cannot transition to `published` or create an active `marketplace_listings` record unless `verificationStatus === 'verified'` AND `technicalEvalStatus === 'completed'`.
- **Gate 3 — Discovery Candidate Policy**: `discovery_candidates` records always carry `status: 'candidate'` and an explicit disclaimer that repository inactivity does not prove abandonment, ownership availability, or right to commercialize.
- **Gate 4 — Dispute Takedown**: Filing an `ownership_claim` or `takedown` dispute automatically transitions active marketplace listings for that asset to `suspended` and flags `moderationStatus: 'flagged'`.
- **Gate 5 — Offer Counterparty Rule**: An offer proposer cannot accept their own offer (`403 FORBIDDEN`); counterparty approval is required.
- **Gate 6 — Agreement & Settlement Sequence**: Transaction initiation requires an `executed` agreement signed by both owner and buyer organizations. Handover delivery requires a `captured` or `settled` transaction.
