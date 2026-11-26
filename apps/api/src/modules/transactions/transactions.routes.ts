import { Router } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import {
  agreements,
  assetHandovers,
  assetHistory,
  assets,
  assetVersions,
  deals,
  payments,
  refunds,
  systemSettings,
  transactions,
} from '../../db/schema.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { createNotification, recordAuditLog } from '../../services/audit.service.js';
import { manualInvoiceProvider, razorpayProvider } from '../../services/payment.service.js';
import { generateCode, sha256Hex } from '../../utils/crypto.js';
import {
  asyncHandler,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const transactionsRouter = Router();

async function getCommissionBps(dealType: string): Promise<number> {
  const db = await getDb();
  const setting = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.settingKey, 'pricing.commission_bps'),
  });
  const map = (setting?.settingValue as Record<string, number> | undefined) ?? {};
  return typeof map[dealType] === 'number' ? map[dealType] : 1000; // Default 10%
}

transactionsRouter.post(
  '/deals/:id/transactions/initiate',
  requireAuth,
  requirePermission('transaction:initiate'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        idempotencyKey: z.string().trim().min(8).max(120),
        preferredProvider: z.enum(['auto', 'razorpay', 'manual_invoice_settlement']).default('auto'),
      })
      .parse(req.body);

    if (req.auth!.isDemoAccount) {
      throw new ForbiddenError(
        'Demo accounts cannot initiate real payments or commercial financial transactions',
      );
    }

    const db = await getDb();
    // Idempotency guard
    const existingTxn = await db.query.transactions.findFirst({
      where: eq(transactions.idempotencyKey, input.idempotencyKey),
    });
    if (existingTxn) {
      const existingPayment = await db.query.payments.findFirst({
        where: eq(payments.transactionId, existingTxn.id),
      });
      res.json({ transaction: existingTxn, payment: existingPayment, idempotentReplay: true });
      return;
    }

    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    if (deal.buyerOrgId !== req.auth!.organizationId) {
      throw new ForbiddenError('Only the buyer organization can initiate transaction payment');
    }
    if (req.auth!.isDemoAccount) {
      throw new ForbiddenError(
        'Demo accounts cannot initiate real payments or commercial financial transactions',
      );
    }
    if (!deal.agreedAmountMinor || deal.agreedAmountMinor <= 0) {
      throw new BadRequestError('Deal has no agreed commercial amount');
    }

    const executedAgreement = await db.query.agreements.findFirst({
      where: and(eq(agreements.dealId, deal.id), eq(agreements.status, 'executed')),
    });
    if (!executedAgreement) {
      throw new BadRequestError('Agreement must be executed by both parties prior to payment initiation');
    }

    // Server-side authoritative amount & commission calculation (never trust client amounts)
    const grossAmountMinor = deal.agreedAmountMinor;
    const commissionRateBps = await getCommissionBps(deal.dealType);
    const commissionAmountMinor = Math.round((grossAmountMinor * commissionRateBps) / 10_000);
    const netPayoutMinor = grossAmountMinor - commissionAmountMinor;
    const transactionCode = generateCode('TXN');

    const useRazorpay =
      (input.preferredProvider === 'razorpay' || input.preferredProvider === 'auto') &&
      razorpayProvider.isConfigured();

    const orderResult = useRazorpay
      ? await razorpayProvider.createOrder({
          transactionCode,
          amountMinor: grossAmountMinor,
          currency: deal.currency,
          notes: { dealId: deal.id, dealCode: deal.dealCode },
        })
      : await manualInvoiceProvider.createOrder({
          transactionCode,
          amountMinor: grossAmountMinor,
          currency: deal.currency,
        });

    const created = await db.transaction(async (tx) => {
      const [txn] = await tx
        .insert(transactions)
        .values({
          transactionCode,
          dealId: deal.id,
          assetId: deal.assetId,
          payerUserId: req.auth!.userId,
          payeeOrgId: deal.ownerOrgId,
          transactionType: deal.dealType,
          currency: deal.currency,
          grossAmountMinor,
          commissionRateBps,
          commissionAmountMinor,
          netPayoutMinor,
          settlementMode: orderResult.settlementMode,
          status: 'initiated',
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      const [payment] = await tx
        .insert(payments)
        .values({
          transactionId: txn.id,
          provider: orderResult.provider,
          providerOrderId: orderResult.providerOrderId,
          amountMinor: grossAmountMinor,
          currency: deal.currency,
          status: 'created',
          rawPayload: orderResult.checkoutConfig,
        })
        .returning();

      await tx
        .update(assets)
        .set({ lifecycleStatus: 'under_transaction', updatedAt: new Date() })
        .where(eq(assets.id, deal.assetId));

      return { txn, payment };
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.auth!.organizationId,
      action: 'transaction.initiated',
      resourceType: 'transaction',
      resourceId: created.txn.id,
      metadata: { grossAmountMinor, commissionAmountMinor, settlementMode: orderResult.settlementMode },
    });

    res.status(201).json({
      transaction: created.txn,
      payment: created.payment,
      checkoutConfig: orderResult.checkoutConfig,
    });
  }),
);

// Verify Razorpay checkout payment signature (server-side verification)
transactionsRouter.post(
  '/transactions/:id/verify-razorpay',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        razorpayOrderId: z.string().min(4),
        razorpayPaymentId: z.string().min(4),
        razorpaySignature: z.string().min(8),
      })
      .parse(req.body);

    const db = await getDb();
    const txn = await db.query.transactions.findFirst({ where: eq(transactions.id, req.params.id) });
    if (!txn) throw new NotFoundError('Transaction not found');
    if (txn.payerUserId !== req.auth!.userId) {
      throw new ForbiddenError('Unauthorized');
    }

    const valid = razorpayProvider.verifyPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!valid) {
      throw new BadRequestError('Invalid Razorpay payment signature');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          providerPaymentId: input.razorpayPaymentId,
          providerSignatureVerified: true,
          status: 'captured',
        })
        .where(eq(payments.transactionId, txn.id));

      await tx
        .update(transactions)
        .set({ status: 'captured', updatedAt: new Date() })
        .where(eq(transactions.id, txn.id));

      await tx
        .update(deals)
        .set({ status: 'handover_pending', updatedAt: new Date() })
        .where(eq(deals.id, txn.dealId));
    });

    res.json({ verified: true, status: 'captured' });
  }),
);

// Razorpay Webhook Endpoint (validates HMAC signature against raw payload)
transactionsRouter.post(
  '/payments/webhooks/razorpay',
  asyncHandler(async (req, res) => {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!razorpayProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenError('Invalid webhook signature');
    }

    const event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
    };

    const paymentEntity = event.payload?.payment?.entity;
    if (paymentEntity?.order_id) {
      const db = await getDb();
      const paymentRow = await db.query.payments.findFirst({
        where: eq(payments.providerOrderId, paymentEntity.order_id),
      });
      if (paymentRow && event.event === 'payment.captured') {
        const txn = await db.query.transactions.findFirst({
          where: eq(transactions.id, paymentRow.transactionId),
        });
        if (txn && txn.grossAmountMinor === paymentEntity.amount) {
          await db.transaction(async (tx) => {
            await tx
              .update(payments)
              .set({
                providerPaymentId: paymentEntity.id ?? null,
                providerSignatureVerified: true,
                status: 'captured',
              })
              .where(eq(payments.id, paymentRow.id));
            await tx
              .update(transactions)
              .set({ status: 'captured', updatedAt: new Date() })
              .where(eq(transactions.id, txn.id));
            await tx
              .update(deals)
              .set({ status: 'handover_pending', updatedAt: new Date() })
              .where(eq(deals.id, txn.dealId));
          });
        }
      }
    }

    res.json({ received: true });
  }),
);

// Manual Invoice Reconciliation (Authorized Platform Admin / Finance Settlement)
transactionsRouter.post(
  '/transactions/:id/confirm-settlement',
  requireAuth,
  requirePermission('admin:transactions'),
  asyncHandler(async (req, res) => {
    const { settlementReference } = z
      .object({ settlementReference: z.string().trim().min(4).max(120) })
      .parse(req.body);

    const db = await getDb();
    const txn = await db.query.transactions.findFirst({ where: eq(transactions.id, req.params.id) });
    if (!txn) throw new NotFoundError('Transaction not found');

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          providerPaymentId: settlementReference,
          providerSignatureVerified: true,
          status: 'settled',
        })
        .where(eq(payments.transactionId, txn.id));

      await tx
        .update(transactions)
        .set({ status: 'settled', updatedAt: new Date() })
        .where(eq(transactions.id, txn.id));

      await tx
        .update(deals)
        .set({ status: 'handover_pending', updatedAt: new Date() })
        .where(eq(deals.id, txn.dealId));
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: 'transaction.manual_settlement_confirmed',
      resourceType: 'transaction',
      resourceId: txn.id,
      metadata: { settlementReference },
    });

    res.json({ settled: true });
  }),
);

transactionsRouter.post(
  '/transactions/:id/refund',
  requireAuth,
  requirePermission('transaction:refund'),
  asyncHandler(async (req, res) => {
    const { reason, amountMinor } = z
      .object({
        reason: z.string().trim().min(10).max(1000),
        amountMinor: z.number().int().positive().optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const txn = await db.query.transactions.findFirst({ where: eq(transactions.id, req.params.id) });
    if (!txn) throw new NotFoundError('Transaction not found');

    const refundAmount = amountMinor ?? txn.grossAmountMinor;
    if (refundAmount > txn.grossAmountMinor) {
      throw new BadRequestError('Refund amount cannot exceed gross transaction amount');
    }

    const [refund] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(refunds)
        .values({
          transactionId: txn.id,
          requestedByUserId: req.auth!.userId,
          amountMinor: refundAmount,
          reason,
          status: 'processed',
          processedAt: new Date(),
        })
        .returning();

      await tx
        .update(transactions)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(transactions.id, txn.id));

      return created;
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: 'transaction.refunded',
      resourceType: 'refund',
      resourceId: refund.id,
      metadata: { transactionId: txn.id, refundAmount },
    });

    res.status(201).json({ refund });
  }),
);

transactionsRouter.get(
  '/transactions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const isAdmin = req.auth!.permissions.has('admin:transactions');
    const orgId = req.auth!.organizationId!;

    const rows = await db
      .select({
        transaction: transactions,
        assetName: assets.name,
        dealCode: deals.dealCode,
      })
      .from(transactions)
      .innerJoin(assets, eq(transactions.assetId, assets.id))
      .innerJoin(deals, eq(transactions.dealId, deals.id))
      .where(
        isAdmin
          ? undefined
          : or(eq(transactions.payerUserId, req.auth!.userId), eq(transactions.payeeOrgId, orgId)),
      )
      .orderBy(desc(transactions.createdAt));

    res.json({ transactions: rows });
  }),
);

// Asset Handover & Receipt Confirmation
transactionsRouter.post(
  '/deals/:id/handover/deliver',
  requireAuth,
  requirePermission('handover:deliver'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        deliveryNotes: z.string().trim().min(10).max(3000),
        deliveryPackageKey: z.string().trim().min(4).max(400).optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    if (deal.ownerOrgId !== req.auth!.organizationId) {
      throw new ForbiddenError('Only the owner organization can deliver the asset handover');
    }

    const paidTxn = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.dealId, deal.id),
        or(eq(transactions.status, 'captured'), eq(transactions.status, 'settled')),
      ),
    });
    if (!paidTxn) {
      throw new BadRequestError('Payment must be captured or settled before executing asset handover');
    }

    const latestVersion = await db.query.assetVersions.findFirst({
      where: eq(assetVersions.assetId, deal.assetId),
      orderBy: desc(assetVersions.createdAt),
    });

    const pkgKey =
      input.deliveryPackageKey ||
      latestVersion?.archiveStorageKey ||
      `handovers/${deal.id}/authorized-release-bundle`;
    const checksum =
      latestVersion?.archiveSha256 || sha256Hex(`${deal.id}:${pkgKey}:${Date.now()}`);

    const [handover] = await db
      .insert(assetHandovers)
      .values({
        dealId: deal.id,
        transactionId: paidTxn.id,
        assetVersionId: latestVersion?.id ?? null,
        deliveredByUserId: req.auth!.userId,
        deliveryPackageKey: pkgKey,
        deliveryChecksumSha256: checksum,
        deliveryNotes: input.deliveryNotes,
        status: 'delivered',
      })
      .returning();

    await createNotification({
      userId: deal.buyerUserId,
      category: 'handover',
      title: `Asset Handover Delivered for Deal ${deal.dealCode}`,
      body: 'Review delivery checksum and confirm receipt to finalize commercialization.',
      actionUrl: `/dashboard/deals/${deal.id}`,
    });

    res.status(201).json({ handover });
  }),
);

transactionsRouter.post(
  '/deals/:id/handover/confirm',
  requireAuth,
  requirePermission('handover:confirm'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    if (deal.buyerOrgId !== req.auth!.organizationId) {
      throw new ForbiddenError('Only the buyer organization can confirm receipt');
    }

    const handover = await db.query.assetHandovers.findFirst({
      where: eq(assetHandovers.dealId, deal.id),
      orderBy: desc(assetHandovers.deliveredAt),
    });
    if (!handover) throw new NotFoundError('No handover delivery found for this deal');

    const finalAssetStatus =
      deal.dealType === 'full_transfer'
        ? 'transferred'
        : deal.dealType === 'revival_partnership' || deal.dealType === 'repurposing_partnership'
          ? 'revival_in_progress'
          : 'licensed';

    await db.transaction(async (tx) => {
      await tx
        .update(assetHandovers)
        .set({ acceptedByUserId: req.auth!.userId, acceptedAt: new Date(), status: 'accepted' })
        .where(eq(assetHandovers.id, handover.id));

      await tx
        .update(deals)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(deals.id, deal.id));

      await tx
        .update(assets)
        .set({ lifecycleStatus: finalAssetStatus, updatedAt: new Date() })
        .where(eq(assets.id, deal.assetId));

      await tx.insert(assetHistory).values({
        assetId: deal.assetId,
        actorUserId: req.auth!.userId,
        eventType: 'handover.accepted',
        toStatus: finalAssetStatus,
        notes: `Handover confirmed for deal ${deal.dealCode}`,
      });
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.auth!.organizationId,
      action: 'handover.confirmed',
      resourceType: 'asset_handover',
      resourceId: handover.id,
      metadata: { dealId: deal.id, finalAssetStatus },
    });

    res.json({ confirmed: true, dealStatus: 'completed', assetStatus: finalAssetStatus });
  }),
);
