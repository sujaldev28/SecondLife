# SecondLife — Business Model & Revenue Architecture

All pricing tiers, evaluation fees, and marketplace commission rates are stored in configurable platform settings (`system_settings` and `subscription_plans` tables) and enforced server-side. No commercial rates are hardcoded in client logic.

## Revenue Streams
1. **Asset Evaluation Fees**: Optional paid deep technical & commercial due-diligence evaluation reports for complex repositories or third-party buyer requests.
2. **Licensing Transaction Commissions**: Configurable percentage commission (default platform baseline: 10%, configurable by admin) applied to non-exclusive and exclusive software licensing deals.
3. **Asset Transfer Commissions**: Configurable transaction commission (default baseline: 8%, configurable by admin) on full IP/codebase transfers and acquisitions.
4. **Revival & Modernization Partnerships**: Platform-facilitated commercial agreements pairing asset owners with engineering/revival partners under milestone or revenue-share arrangements.
5. **Premium Subscriptions**: Paid monthly/annual plans for active owners and buyers unlocking higher asset limits, priority analysis queues, asset comparison, and advanced matching alerts.
6. **Enterprise Subscriptions & Discovery Services**: Multi-seat organization workspaces, custom discovery pipelines, dedicated compliance review, and API/report exports.

## Payment & Regulatory Compliance Note (India-First)
- SecondLife integrates with **Razorpay** through a provider-agnostic `PaymentProvider` interface.
- For multi-party marketplace payouts/splits, holding third-party funds requires regulated escrow or marketplace split settlements (e.g., Razorpay Route) approved for the merchant account. Where automated split settlement is not enabled on the merchant account, SecondLife supports direct platform-fee collection / verified invoice settlement with explicit manual payout reconciliation tracking and full audit trails.
