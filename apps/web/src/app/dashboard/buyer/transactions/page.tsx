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
    currency: string;
    settlementMode: string;
    status: string;
  };
  assetName: string;
  dealCode: string;
}

export default function BuyerTransactionsPage() {
  const [txns, setTxns] = useState<TxnRow[]>([]);

  useEffect(() => {
    apiFetch<{ transactions: TxnRow[] }>('/transactions').then((d) => setTxns(d.transactions)).catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="buyer"
      title="Buyer Transactions"
      subtitle="Payment history, settlement status, and invoice references."
    >
      {txns.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No payments initiated yet"
          description="Executed deal agreements ready for payment will display settlement history here."
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-token bg-elevated text-xs text-muted-token">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.transaction.id} className="border-b border-token/60">
                    <td className="px-4 py-3 font-mono text-xs text-[#22D3EE]">{t.transaction.transactionCode}</td>
                    <td className="px-4 py-3 font-semibold text-primary-token">{t.assetName}</td>
                    <td className="px-4 py-3 text-xs text-secondary-token">{formatLabel(t.transaction.settlementMode)}</td>
                    <td className="px-4 py-3 font-bold text-primary-token tabular-nums">{formatMoney(t.transaction.grossAmountMinor, t.transaction.currency)}</td>
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
