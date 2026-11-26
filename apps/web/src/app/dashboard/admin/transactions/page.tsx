'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatMoney } from '@/lib/api';

interface TxnRow {
  transaction: {
    id: string;
    transactionCode: string;
    grossAmountMinor: number;
    commissionAmountMinor: number;
    currency: string;
    settlementMode: string;
    status: string;
  };
  assetName: string;
  dealCode: string;
}

export default function AdminTransactionsPage() {
  const { pushToast } = useToast();
  const [txns, setTxns] = useState<TxnRow[]>([]);

  const load = () =>
    apiFetch<{ transactions: TxnRow[] }>('/transactions').then((d) => setTxns(d.transactions));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const confirmSettlement = async (id: string) => {
    const ref = `UTR-${Date.now()}`;
    await apiFetch(`/transactions/${id}/confirm-settlement`, {
      method: 'POST',
      body: JSON.stringify({ settlementReference: ref }),
    });
    pushToast(`Manual invoice settlement confirmed (${ref})`, 'success');
    await load();
  };

  const refund = async (id: string) => {
    await apiFetch(`/transactions/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Administrative compliance refund' }),
    });
    pushToast('Transaction refunded', 'info');
    await load();
  };

  return (
    <DashboardShell
      mode="admin"
      title="Transactions & Settlement Reconciliation"
      subtitle="Verify invoice settlements, monitor commissions, and process authorized refunds."
    >
      {txns.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No transactions yet"
          description="Initiated deal settlements will appear here for reconciliation."
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-token bg-elevated text-xs text-muted-token">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Asset / Deal</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.transaction.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                    <td className="px-4 py-3 font-mono text-xs text-[#22D3EE]">{t.transaction.transactionCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-primary-token">{t.assetName}</div>
                      <div className="text-xs text-muted-token">{t.dealCode}</div>
                    </td>
                    <td className="px-4 py-3 text-primary-token tabular-nums">{formatMoney(t.transaction.grossAmountMinor, t.transaction.currency)}</td>
                    <td className="px-4 py-3 font-semibold text-[#34D399] tabular-nums">{formatMoney(t.transaction.commissionAmountMinor, t.transaction.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.transaction.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {t.transaction.status === 'initiated' && (
                          <Button type="button" onClick={() => confirmSettlement(t.transaction.id)} className="px-2.5 py-1 text-xs">
                            Confirm Settlement
                          </Button>
                        )}
                        {(t.transaction.status === 'captured' || t.transaction.status === 'settled') && (
                          <Button type="button" variant="destructive" onClick={() => refund(t.transaction.id)} className="px-2.5 py-1 text-xs">
                            Refund
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </DashboardShell>
  );
}
