import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { timingSafeEqualStr } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

export interface CreateOrderParams {
  transactionCode: string;
  amountMinor: number;
  currency: string;
  notes?: Record<string, string>;
}

export interface ProviderOrderResult {
  provider: 'razorpay' | 'manual_invoice_settlement';
  providerOrderId: string;
  settlementMode: 'razorpay_order' | 'manual_invoice_settlement';
  checkoutConfig: Record<string, unknown>;
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<ProviderOrderResult>;
  verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  isConfigured(): boolean {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  }

  async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    if (!this.isConfigured()) {
      throw new BadRequestError(
        'Razorpay credentials are not configured; use manual_invoice_settlement workflow.',
      );
    }

    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amountMinor,
        currency: params.currency,
        receipt: params.transactionCode,
        notes: params.notes ?? {},
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      throw new BadRequestError(`Razorpay order creation failed (${resp.status})`);
    }
    const order = (await resp.json()) as { id: string };
    return {
      provider: 'razorpay',
      providerOrderId: order.id,
      settlementMode: 'razorpay_order',
      checkoutConfig: {
        keyId: env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amountMinor: params.amountMinor,
        currency: params.currency,
      },
    };
  }

  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    return timingSafeEqualStr(expected, params.signature);
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signatureHeader) return false;
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqualStr(expected, signatureHeader);
  }
}

export class ManualInvoiceSettlementProvider implements PaymentProvider {
  async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    return {
      provider: 'manual_invoice_settlement',
      providerOrderId: `INV-${params.transactionCode}`,
      settlementMode: 'manual_invoice_settlement',
      checkoutConfig: {
        invoiceReference: `INV-${params.transactionCode}`,
        amountMinor: params.amountMinor,
        currency: params.currency,
        instructions:
          'Automated third-party split settlement is not enabled. Settle via verified invoice/escrow wire and confirm reference with platform finance admin.',
      },
    };
  }

  verifyPaymentSignature(): boolean {
    return false;
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
}

export const razorpayProvider = new RazorpayPaymentProvider();
export const manualInvoiceProvider = new ManualInvoiceSettlementProvider();
