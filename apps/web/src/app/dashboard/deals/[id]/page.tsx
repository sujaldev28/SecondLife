'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Send } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface DealDetailPayload {
  deal: {
    id: string;
    dealCode: string;
    dealType: string;
    status: string;
    agreedAmountMinor: number | null;
    currency: string;
    buyerOrgId: string;
    ownerOrgId: string;
  };
  asset: { id: string; name: string; assetCode: string };
  messages: Array<{ id: string; senderUserId: string; body: string; messageType: string; createdAt: string }>;
  offers: Array<{
    id: string;
    revisionNumber: number;
    offerType: string;
    amountMinor: number;
    currency: string;
    termsSummary: string;
    status: string;
    proposedByUserId: string;
  }>;
  agreements: Array<{
    id: string;
    title: string;
    termsBody: string;
    documentHash: string;
    status: string;
    ownerAcceptedAt: string | null;
    buyerAcceptedAt: string | null;
  }>;
}

const TIMELINE_STAGES = [
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'agreement_pending', label: 'Agreement' },
  { key: 'payment_pending', label: 'Settlement' },
  { key: 'handover_pending', label: 'Handover' },
  { key: 'completed', label: 'Completed' },
];

export default function DealRoomPage() {
  const params = useParams<{ id: string }>();
  const { user, activeOrganizationId } = useAuth();
  const { pushToast } = useToast();
  const [data, setData] = useState<DealDetailPayload | null>(null);
  const [msgText, setMsgText] = useState('');
  const [offerAmountInr, setOfferAmountInr] = useState('250000');
  const [offerTerms, setOfferTerms] = useState('Commercial licensing terms with 30-day technical handover.');
  const [agreementTitle, setAgreementTitle] = useState('Commercial Digital Asset License Agreement');
  const [agreementBody, setAgreementBody] = useState(
    'Licensor grants Licensee commercial rights in accordance with the accepted offer, subject to full settlement and checksummed asset delivery.',
  );
  const [deliveryNotes, setDeliveryNotes] = useState('Authorized release package and documentation delivered.');
  const [error, setError] = useState('');

  const load = () =>
    apiFetch<DealDetailPayload>(`/deals/${params.id}`)
      .then(setData)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const isBuyer = data?.deal.buyerOrgId === activeOrganizationId;
  const isOwner = data?.deal.ownerOrgId === activeOrganizationId;
  const mode = isBuyer ? 'buyer' : 'owner';

  const stageIdx = data ? Math.max(0, TIMELINE_STAGES.findIndex((s) => s.key === data.deal.status)) : 0;

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch(`/deals/${params.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: msgText }),
    });
    setMsgText('');
    await load();
  };

  const submitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/deals/${params.id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          offerType: data?.deal.dealType || 'non_exclusive_license',
          amountMinor: Math.round(Number(offerAmountInr) * 100),
          currency: 'INR',
          termsSummary: offerTerms,
        }),
      });
      pushToast('Offer submitted to counterparty', 'success');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const respondOffer = async (offerId: string, decision: 'accepted' | 'rejected') => {
    setError('');
    try {
      await apiFetch(`/offers/${offerId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      pushToast(`Offer ${decision}`, 'success');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/deals/${params.id}/agreements`, {
        method: 'POST',
        body: JSON.stringify({ title: agreementTitle, termsBody: agreementBody }),
      });
      pushToast('Agreement drafted and hashed', 'success');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const signAgreement = async (agreementId: string) => {
    setError('');
    const res = await apiFetch<{ fullyExecuted: boolean }>(`/agreements/${agreementId}/sign`, {
      method: 'POST',
    });
    pushToast(
      res.fullyExecuted ? 'Agreement fully executed! Ready for settlement.' : 'Signature recorded.',
      'success',
    );
    await load();
  };

  const initiatePayment = async () => {
    setError('');
    try {
      const res = await apiFetch<{
        transaction: { transactionCode: string; settlementMode: string; commissionAmountMinor: number };
      }>(`/deals/${params.id}/transactions/initiate`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: `deal-${params.id}-${Date.now()}` }),
      });
      pushToast(
        `Transaction ${res.transaction.transactionCode} initiated (${res.transaction.settlementMode})`,
        'success',
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deliverHandover = async () => {
    setError('');
    try {
      await apiFetch(`/deals/${params.id}/handover/deliver`, {
        method: 'POST',
        body: JSON.stringify({ deliveryNotes }),
      });
      pushToast('Asset handover package delivered with SHA-256 checksum', 'success');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmHandover = async () => {
    setError('');
    try {
      await apiFetch(`/deals/${params.id}/handover/confirm`, { method: 'POST' });
      pushToast('Receipt confirmed! Deal completed.', 'success');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <DashboardShell
      mode={mode}
      title={data ? `Deal Room ${data.deal.dealCode}` : 'Deal Room'}
      subtitle={data ? `${data.asset.name} • ${formatLabel(data.deal.dealType)}` : 'Loading...'}
    >
      {error && (
        <div className="mb-4 rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs text-[#FB7185]">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Visual Deal Timeline */}
          <SurfaceCard className="p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TIMELINE_STAGES.map((st, idx) => {
                const done = idx < stageIdx || data.deal.status === 'completed';
                const current = st.key === data.deal.status;
                return (
                  <div
                    key={st.key}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                      done
                        ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]'
                        : current
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-primary-token'
                          : 'border-token bg-elevated text-muted-token'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                      {done ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    <span>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Messaging Thread */}
            <SurfaceCard className="flex flex-col p-5 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-token pb-3">
                <div>
                  <h2 className="text-sm font-bold text-primary-token">
                    Negotiation &amp; Due Diligence Thread
                  </h2>
                  <p className="text-xs text-muted-token">
                    Agreed Value: {formatMoney(data.deal.agreedAmountMinor, data.deal.currency)}
                  </p>
                </div>
                <StatusBadge status={data.deal.status} />
              </div>

              <div className="my-4 max-h-96 flex-1 space-y-3 overflow-y-auto pr-1">
                {data.messages.map((m) => {
                  const mine = m.senderUserId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3.5 text-sm ${
                        mine
                          ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/12 text-primary-token'
                          : 'border-token bg-elevated text-secondary-token'
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-muted-token">
                        {mine ? 'You' : 'Counterparty'} • {formatLabel(m.messageType)}
                      </div>
                      <p className="mt-1">{m.body}</p>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} className="flex gap-2 border-t border-token pt-3">
                <input
                  required
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Write a message or due diligence request..."
                  className="sl-input flex-1 rounded-xl px-3.5 py-2 text-sm"
                />
                <Button type="submit" className="px-4 py-2 text-xs">
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Button>
              </form>
            </SurfaceCard>

            {/* Offers, Agreements & Settlement */}
            <div className="space-y-5">
              <SurfaceCard className="p-5">
                <form onSubmit={submitOffer} className="space-y-3">
                  <h3 className="text-sm font-bold text-primary-token">Commercial Offers</h3>
                  <input
                    type="number"
                    value={offerAmountInr}
                    onChange={(e) => setOfferAmountInr(e.target.value)}
                    className="sl-input w-full rounded-xl px-3 py-2 text-sm"
                    placeholder="Offer Amount (INR)"
                  />
                  <textarea
                    rows={2}
                    value={offerTerms}
                    onChange={(e) => setOfferTerms(e.target.value)}
                    className="sl-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                  <Button type="submit" className="w-full py-2 text-xs">
                    Submit Offer
                  </Button>
                </form>

                <div className="mt-4 space-y-2.5">
                  {data.offers.map((o) => (
                    <div key={o.id} className="rounded-xl border border-token bg-elevated p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <strong className="text-primary-token">
                          Rev #{o.revisionNumber} • {formatMoney(o.amountMinor, o.currency)}
                        </strong>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-1 text-secondary-token">{o.termsSummary}</p>
                      {o.status === 'pending' && o.proposedByUserId !== user?.id && (
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => respondOffer(o.id, 'accepted')}
                            className="rounded-lg bg-[#34D399]/20 px-3 py-1 font-semibold text-[#34D399] cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => respondOffer(o.id, 'rejected')}
                            className="rounded-lg border border-token px-3 py-1 font-semibold text-[#FB7185] cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard className="space-y-3 p-5">
                <h3 className="text-sm font-bold text-primary-token">Agreement, Payment &amp; Handover</h3>
                {data.agreements.length === 0 ? (
                  <form onSubmit={createAgreement} className="space-y-2.5">
                    <input
                      value={agreementTitle}
                      onChange={(e) => setAgreementTitle(e.target.value)}
                      className="sl-input w-full rounded-xl px-3 py-2 text-xs"
                    />
                    <textarea
                      rows={3}
                      value={agreementBody}
                      onChange={(e) => setAgreementBody(e.target.value)}
                      className="sl-input w-full rounded-xl px-3 py-2 text-xs"
                    />
                    <Button type="submit" variant="secondary" className="w-full py-2 text-xs">
                      Draft Agreement
                    </Button>
                  </form>
                ) : (
                  data.agreements.map((a) => (
                    <div key={a.id} className="space-y-2 rounded-xl border border-token bg-elevated p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-primary-token">{a.title}</strong>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-secondary-token">{a.termsBody}</p>
                      <div className="font-mono text-[10px] text-muted-token">
                        SHA-256: {a.documentHash.slice(0, 20)}...
                      </div>
                      {a.status !== 'executed' && (
                        <Button type="button" onClick={() => signAgreement(a.id)} className="w-full py-1.5 text-xs">
                          Sign Agreement
                        </Button>
                      )}
                    </div>
                  ))
                )}

                {isBuyer && data.deal.status === 'payment_pending' && (
                  <Button type="button" onClick={initiatePayment} className="w-full py-2 text-xs">
                    Initiate Settlement / Payment
                  </Button>
                )}

                {isOwner && data.deal.status === 'handover_pending' && (
                  <div className="space-y-2 border-t border-token pt-3">
                    <textarea
                      rows={2}
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="sl-input w-full rounded-xl px-3 py-2 text-xs"
                    />
                    <Button type="button" onClick={deliverHandover} className="w-full py-2 text-xs">
                      Deliver Asset Handover
                    </Button>
                  </div>
                )}

                {isBuyer && data.deal.status === 'handover_pending' && (
                  <Button type="button" onClick={confirmHandover} className="w-full py-2 text-xs">
                    Confirm Receipt &amp; Complete Deal
                  </Button>
                )}
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
