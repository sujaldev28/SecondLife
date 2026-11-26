import { Router } from 'express';
import { desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { createInquirySchema, createOfferSchema } from '@secondlife/shared';
import { getDb } from '../../db/client.js';
import {
  agreements,
  assets,
  conversations,
  deals,
  inquiries,
  marketplaceListings,
  messages,
  offers,
} from '../../db/schema.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { createNotification, recordAuditLog } from '../../services/audit.service.js';
import { generateCode, sha256Hex } from '../../utils/crypto.js';
import {
  asyncHandler,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const dealsRouter = Router();

function assertDealParticipant(
  deal: typeof deals.$inferSelect,
  req: import('express').Request,
): void {
  const isDealManager = req.auth!.permissions.has('deal:manage_all');
  const isParticipantOrg =
    deal.buyerOrgId === req.auth!.organizationId || deal.ownerOrgId === req.auth!.organizationId;
  if (!isDealManager && !isParticipantOrg) {
    throw new ForbiddenError('Access denied: you are not a participant in this deal');
  }
}

dealsRouter.post(
  '/inquiries',
  requireAuth,
  requirePermission('marketplace:inquire'),
  asyncHandler(async (req, res) => {
    const input = createInquirySchema.parse(req.body);
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, input.assetId) });
    if (!asset || asset.marketplaceStatus !== 'published') {
      throw new NotFoundError('Published asset not found');
    }
    if (asset.organizationId === req.auth!.organizationId) {
      throw new BadRequestError('You cannot submit a buyer inquiry on your own organization asset');
    }

    const created = await db.transaction(async (tx) => {
      const [inquiry] = await tx
        .insert(inquiries)
        .values({
          assetId: asset.id,
          listingId: input.listingId ?? null,
          buyerUserId: req.auth!.userId,
          buyerOrgId: req.auth!.organizationId!,
          ownerOrgId: asset.organizationId,
          subject: input.subject,
          intendedUse: input.intendedUse,
          status: 'open',
        })
        .returning();

      const [conversation] = await tx
        .insert(conversations)
        .values({
          inquiryId: inquiry.id,
          assetId: asset.id,
          buyerOrgId: req.auth!.organizationId!,
          ownerOrgId: asset.organizationId,
        })
        .returning();

      await tx.insert(messages).values({
        conversationId: conversation.id,
        senderUserId: req.auth!.userId,
        body: input.message,
        messageType: 'text',
      });

      return { inquiry, conversation };
    });

    await createNotification({
      userId: asset.ownerUserId,
      category: 'inquiry',
      title: `New Buyer Inquiry: ${asset.name}`,
      body: input.subject,
      actionUrl: `/dashboard/owner/inquiries`,
    });

    res.status(201).json(created);
  }),
);

dealsRouter.get(
  '/inquiries',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const orgId = req.auth!.organizationId!;
    const rows = await db
      .select({
        inquiry: inquiries,
        assetName: assets.name,
        assetCode: assets.assetCode,
      })
      .from(inquiries)
      .innerJoin(assets, eq(inquiries.assetId, assets.id))
      .where(or(eq(inquiries.buyerOrgId, orgId), eq(inquiries.ownerOrgId, orgId)))
      .orderBy(desc(inquiries.createdAt));

    res.json({ inquiries: rows });
  }),
);

dealsRouter.post(
  '/inquiries/:id/respond',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { action, note } = z
      .object({
        action: z.enum(['accept', 'decline']),
        note: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const inquiry = await db.query.inquiries.findFirst({ where: eq(inquiries.id, req.params.id) });
    if (!inquiry) throw new NotFoundError('Inquiry not found');
    if (inquiry.ownerOrgId !== req.auth!.organizationId) {
      throw new ForbiddenError('Only the asset owner organization may accept or decline this inquiry');
    }

    if (action === 'decline') {
      await db.update(inquiries).set({ status: 'declined', updatedAt: new Date() }).where(eq(inquiries.id, inquiry.id));
      res.json({ status: 'declined' });
      return;
    }

    const asset = await db.query.assets.findFirst({ where: eq(assets.id, inquiry.assetId) });
    if (!asset) throw new NotFoundError('Asset not found');

    const listing = inquiry.listingId
      ? await db.query.marketplaceListings.findFirst({ where: eq(marketplaceListings.id, inquiry.listingId) })
      : null;

    const deal = await db.transaction(async (tx) => {
      const [createdDeal] = await tx
        .insert(deals)
        .values({
          dealCode: generateCode('DL'),
          assetId: asset.id,
          listingId: listing?.id ?? null,
          inquiryId: inquiry.id,
          buyerUserId: inquiry.buyerUserId,
          buyerOrgId: inquiry.buyerOrgId,
          ownerUserId: asset.ownerUserId,
          ownerOrgId: asset.organizationId,
          dealType: listing?.listingType ?? 'non_exclusive_license',
          status: 'negotiation',
          currency: listing?.currency ?? 'INR',
          agreedAmountMinor: listing?.askingPriceMinor ?? null,
        })
        .returning();

      await tx
        .update(inquiries)
        .set({ status: 'converted_to_deal', updatedAt: new Date() })
        .where(eq(inquiries.id, inquiry.id));

      await tx
        .update(conversations)
        .set({ dealId: createdDeal.id })
        .where(eq(conversations.inquiryId, inquiry.id));

      if (note) {
        const conv = await tx.query.conversations.findFirst({ where: eq(conversations.inquiryId, inquiry.id) });
        if (conv) {
          await tx.insert(messages).values({
            conversationId: conv.id,
            senderUserId: req.auth!.userId,
            body: note,
            messageType: 'text',
          });
        }
      }

      return createdDeal;
    });

    await createNotification({
      userId: inquiry.buyerUserId,
      category: 'deal',
      title: `Inquiry Accepted — Deal Room ${deal.dealCode} Opened`,
      body: `The owner accepted your inquiry on ${asset.name}.`,
      actionUrl: `/dashboard/deals/${deal.id}`,
    });

    res.status(201).json({ deal });
  }),
);

dealsRouter.get(
  '/deals',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const orgId = req.auth!.organizationId!;
    const isManager = req.auth!.permissions.has('deal:manage_all');

    const rows = await db
      .select({
        deal: deals,
        assetName: assets.name,
        assetCode: assets.assetCode,
      })
      .from(deals)
      .innerJoin(assets, eq(deals.assetId, assets.id))
      .where(isManager ? undefined : or(eq(deals.buyerOrgId, orgId), eq(deals.ownerOrgId, orgId)))
      .orderBy(desc(deals.updatedAt));

    res.json({ deals: rows });
  }),
);

dealsRouter.get(
  '/deals/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    assertDealParticipant(deal, req);

    const [asset, conv, dealOffers, dealAgreements] = await Promise.all([
      db.query.assets.findFirst({ where: eq(assets.id, deal.assetId) }),
      db.query.conversations.findFirst({ where: eq(conversations.dealId, deal.id) }),
      db.select().from(offers).where(eq(offers.dealId, deal.id)).orderBy(desc(offers.revisionNumber)),
      db.select().from(agreements).where(eq(agreements.dealId, deal.id)).orderBy(desc(agreements.createdAt)),
    ]);

    const threadMessages = conv
      ? await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt)
      : [];

    res.json({
      deal,
      asset,
      conversationId: conv?.id ?? null,
      messages: threadMessages,
      offers: dealOffers,
      agreements: dealAgreements,
    });
  }),
);

dealsRouter.post(
  '/deals/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { body, messageType } = z
      .object({
        body: z.string().trim().min(1).max(4000),
        messageType: z.enum(['text', 'due_diligence_request']).default('text'),
      })
      .parse(req.body);

    const db = await getDb();
    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    assertDealParticipant(deal, req);

    let conv = await db.query.conversations.findFirst({ where: eq(conversations.dealId, deal.id) });
    if (!conv) {
      const [createdConv] = await db
        .insert(conversations)
        .values({
          dealId: deal.id,
          assetId: deal.assetId,
          buyerOrgId: deal.buyerOrgId,
          ownerOrgId: deal.ownerOrgId,
        })
        .returning();
      conv = createdConv;
    }

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        senderUserId: req.auth!.userId,
        body,
        messageType,
      })
      .returning();

    if (messageType === 'due_diligence_request') {
      await db
        .update(deals)
        .set({ dueDiligenceStatus: 'requested', status: 'due_diligence', updatedAt: new Date() })
        .where(eq(deals.id, deal.id));
    }

    res.status(201).json({ message: msg });
  }),
);

dealsRouter.post(
  '/deals/:id/offers',
  requireAuth,
  requirePermission('deal:negotiate'),
  asyncHandler(async (req, res) => {
    const input = createOfferSchema.parse(req.body);
    const db = await getDb();
    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    assertDealParticipant(deal, req);

    const existing = await db.select().from(offers).where(eq(offers.dealId, deal.id));
    const revisionNumber = existing.length + 1;

    const [offer] = await db
      .insert(offers)
      .values({
        dealId: deal.id,
        proposedByUserId: req.auth!.userId,
        revisionNumber,
        offerType: input.offerType,
        amountMinor: input.amountMinor,
        currency: input.currency,
        termsSummary: input.termsSummary,
        dueDiligenceRequired: input.dueDiligenceRequired,
        supportDays: input.supportDays,
        status: 'pending',
      })
      .returning();

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.auth!.organizationId,
      action: 'deal.offer_submitted',
      resourceType: 'offer',
      resourceId: offer.id,
      metadata: { dealId: deal.id, amountMinor: input.amountMinor },
    });

    res.status(201).json({ offer });
  }),
);

dealsRouter.post(
  '/offers/:offerId/respond',
  requireAuth,
  requirePermission('deal:negotiate'),
  asyncHandler(async (req, res) => {
    const { decision } = z.object({ decision: z.enum(['accepted', 'rejected']) }).parse(req.body);
    const db = await getDb();
    const offer = await db.query.offers.findFirst({ where: eq(offers.id, req.params.offerId) });
    if (!offer) throw new NotFoundError('Offer not found');

    const deal = await db.query.deals.findFirst({ where: eq(deals.id, offer.dealId) });
    if (!deal) throw new NotFoundError('Deal not found');
    assertDealParticipant(deal, req);

    if (offer.proposedByUserId === req.auth!.userId && decision === 'accepted') {
      throw new ForbiddenError('Proposer cannot accept their own offer; counterparty approval is required');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(offers)
        .set({ status: decision, respondedAt: new Date() })
        .where(eq(offers.id, offer.id));

      if (decision === 'accepted') {
        await tx
          .update(deals)
          .set({
            dealType: offer.offerType,
            agreedAmountMinor: offer.amountMinor,
            currency: offer.currency,
            status: 'agreement_pending',
            updatedAt: new Date(),
          })
          .where(eq(deals.id, deal.id));
      }
    });

    res.json({ updated: true, decision });
  }),
);

dealsRouter.post(
  '/deals/:id/agreements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        title: z.string().trim().min(5).max(160),
        termsBody: z.string().trim().min(30).max(20000),
      })
      .parse(req.body);

    const db = await getDb();
    const deal = await db.query.deals.findFirst({ where: eq(deals.id, req.params.id) });
    if (!deal) throw new NotFoundError('Deal not found');
    assertDealParticipant(deal, req);
    if (!deal.agreedAmountMinor) {
      throw new BadRequestError('An offer must be accepted before generating a binding agreement');
    }

    const docHash = sha256Hex(`${deal.id}:${input.title}:${input.termsBody}`);
    const [agreement] = await db
      .insert(agreements)
      .values({
        dealId: deal.id,
        agreementType: deal.dealType,
        title: input.title,
        termsBody: input.termsBody,
        documentHash: docHash,
        status: 'pending_signatures',
      })
      .returning();

    res.status(201).json({ agreement });
  }),
);

dealsRouter.post(
  '/agreements/:agreementId/sign',
  requireAuth,
  requirePermission('agreement:sign'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const agreement = await db.query.agreements.findFirst({
      where: eq(agreements.id, req.params.agreementId),
    });
    if (!agreement) throw new NotFoundError('Agreement not found');

    const deal = await db.query.deals.findFirst({ where: eq(deals.id, agreement.dealId) });
    if (!deal) throw new NotFoundError('Deal not found');
    assertDealParticipant(deal, req);

    const isOwner = req.auth!.organizationId === deal.ownerOrgId;
    const isBuyer = req.auth!.organizationId === deal.buyerOrgId;

    const ownerAcceptedAt = isOwner ? new Date() : agreement.ownerAcceptedAt;
    const buyerAcceptedAt = isBuyer ? new Date() : agreement.buyerAcceptedAt;
    const fullyExecuted = Boolean(ownerAcceptedAt && buyerAcceptedAt);

    const [updated] = await db
      .update(agreements)
      .set({
        ownerAcceptedAt,
        buyerAcceptedAt,
        status: fullyExecuted ? 'executed' : 'pending_signatures',
      })
      .where(eq(agreements.id, agreement.id))
      .returning();

    if (fullyExecuted) {
      await db
        .update(deals)
        .set({ status: 'payment_pending', updatedAt: new Date() })
        .where(eq(deals.id, deal.id));
    }

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.auth!.organizationId,
      action: 'agreement.signed',
      resourceType: 'agreement',
      resourceId: agreement.id,
      metadata: { fullyExecuted },
    });

    res.json({ agreement: updated, fullyExecuted });
  }),
);
