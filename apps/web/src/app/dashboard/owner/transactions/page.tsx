'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface TxnRow {
  transaction: {
    id: string;
    transactionCode: string;
    transactionType: string;
    grossAmountMinor: number;
    commissionAmountMinor: number;
    netPayoutMinor: number;
    currency: string;
    settlementMode: string;
    status: string;
  };
  assetName: string;
  dealCode: string;
}

export default function OwnerTransactionsPage() {
  const [txns, setTxns] = useState<TxnRow[]>([]);

  useEffect(() => {
    apiFetch<{ transactions: TxnRow[] }>('/transactions').then((d) => setTxns(d.transactions)).catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="owner"
      title="Transactions & Payouts"
      subtitle="Audit gross deal amounts, server-computed commissions, and net payout settlements."
    >
      {txns.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No transactions recorded yet"
          description="Executed deal agreements and payment settlements will appear here."
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-token bg-elevated text-xs text-muted-token">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Asset / Deal</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Net Payout</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.transaction.id} className="border-b border-token/60">
                    <td className="px-4 py-3 font-mono text-xs text-[#22D3EE]">{t.transaction.transactionCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-primary-token">{t.assetName}</div>
                      <div className="text-xs text-muted-token">{t.dealCode}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-token">{formatLabel(t.transaction.transactionType)}</td>
                    <td className="px-4 py-3 text-primary-token tabular-nums">{formatMoney(t.transaction.grossAmountMinor, t.transaction.currency)}</td>
                    <td className="px-4 py-3 text-secondary-token tabular-nums">{formatMoney(t.transaction.commissionAmountMinor, t.transaction.currency)}</td>
                    <td className="px-4 py-3 font-bold text-[#34D399] tabular-nums">{formatMoney(t.transaction.netPayoutMinor, t.transaction.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.transaction.status} /></td>
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
