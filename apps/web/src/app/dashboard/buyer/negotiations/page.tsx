'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatMoney } from '@/lib/api';

interface DealRow {
  deal: { id: string; dealCode: string; status: string; agreedAmountMinor: number | null; currency: string };
  assetName: string;
}

export default function BuyerNegotiationsPage() {
  const [deals, setDeals] = useState<DealRow[]>([]);

  useEffect(() => {
    apiFetch<{ deals: DealRow[] }>('/deals').then((d) => setDeals(d.deals)).catch(() => {});
  }, []);

  const active = deals.filter((d) => ['negotiation', 'due_diligence', 'agreement_pending'].includes(d.deal.status));

  return (
    <DashboardShell
      mode="buyer"
      title="Active Negotiations & Due Diligence"
      subtitle="Review pending offers, ask technical due diligence questions, and finalize agreements."
    >
      {active.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-6 w-6" />}
          title="No active negotiations"
          description="When an asset owner accepts your inquiry, the deal room appears here."
        />
      ) : (
        <div className="space-y-3">
          {active.map((d) => (
            <SurfaceCard key={d.deal.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#22D3EE]">{d.deal.dealCode}</span>
                  <StatusBadge status={d.deal.status} />
                </div>
                <div className="mt-1 text-base font-bold text-primary-token">{d.assetName}</div>
                <div className="text-xs text-secondary-token">
                  Target Amount: {formatMoney(d.deal.agreedAmountMinor, d.deal.currency)}
                </div>
              </div>
              <Link href={`/dashboard/deals/${d.deal.id}`} className="sl-gradient-primary rounded-xl px-4 py-2 text-xs font-semibold text-white">
                Enter Deal Room
              </Link>
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
