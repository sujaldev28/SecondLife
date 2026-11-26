'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface DealRow {
  deal: { id: string; dealCode: string; dealType: string; status: string; agreedAmountMinor: number | null; currency: string };
  assetName: string;
}

export default function BuyerDealsPage() {
  const [deals, setDeals] = useState<DealRow[]>([]);

  useEffect(() => {
    apiFetch<{ deals: DealRow[] }>('/deals').then((d) => setDeals(d.deals)).catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="buyer"
      title="Buyer Deals"
      subtitle="All acquisition, licensing, and revival deals."
    >
      {deals.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="No deals found yet"
          description="Inquiries accepted by asset owners convert directly into deal rooms."
        />
      ) : (
        <div className="space-y-3">
          {deals.map((d) => (
            <SurfaceCard key={d.deal.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#22D3EE]">{d.deal.dealCode}</span>
                  <StatusBadge status={d.deal.status} />
                </div>
                <div className="mt-1 text-base font-bold text-primary-token">{d.assetName}</div>
                <div className="text-xs text-secondary-token">
                  {formatLabel(d.deal.dealType)} • {formatMoney(d.deal.agreedAmountMinor, d.deal.currency)}
                </div>
              </div>
              <Link href={`/dashboard/deals/${d.deal.id}`} className="sl-gradient-primary rounded-xl px-4 py-2 text-xs font-semibold text-white">
                Open Deal Room
              </Link>
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
