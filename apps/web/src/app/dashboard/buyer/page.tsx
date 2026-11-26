'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, Briefcase, ClipboardList, Search, Sparkles, Wallet } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { KpiCard, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

export default function BuyerOverviewPage() {
  const [savedCount, setSavedCount] = useState(0);
  const [reqCount, setReqCount] = useState(0);
  const [dealCount, setDealCount] = useState(0);
  const [txnCount, setTxnCount] = useState(0);

  useEffect(() => {
    Promise.all([
      apiFetch<{ savedAssets: unknown[] }>('/saved-assets').catch(() => ({ savedAssets: [] })),
      apiFetch<{ requirements: unknown[] }>('/buyer/requirements').catch(() => ({ requirements: [] })),
      apiFetch<{ deals: unknown[] }>('/deals').catch(() => ({ deals: [] })),
      apiFetch<{ transactions: unknown[] }>('/transactions').catch(() => ({ transactions: [] })),
    ]).then(([s, r, d, t]) => {
      setSavedCount(s.savedAssets.length);
      setReqCount(r.requirements.length);
      setDealCount(d.deals.length);
      setTxnCount(t.transactions.length);
    });
  }, []);

  return (
    <DashboardShell
      mode="buyer"
      title="Buyer & Sourcing Overview"
      subtitle="Define acquisition criteria, inspect explainable recommendations, and manage active deal rooms."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Saved Assets" value={savedCount} accent="cyan" icon={<Bookmark className="h-4 w-4" />} />
        <KpiCard label="Requirements" value={reqCount} accent="violet" icon={<ClipboardList className="h-4 w-4" />} />
        <KpiCard label="Active Deals" value={dealCount} accent="emerald" icon={<Briefcase className="h-4 w-4" />} />
        <KpiCard label="Transactions" value={txnCount} accent="amber" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2 text-[#E879F9]">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-base font-bold text-primary-token">Get Explainable Asset Matches</h2>
          </div>
          <p className="mt-2 text-sm text-secondary-token">
            Specify your required technology stack, licensing preferences, minimum technical score,
            and budget to compute transparent compatibility scores.
          </p>
          <Link
            href="/dashboard/buyer/requirements"
            className="sl-gradient-primary mt-5 inline-flex rounded-xl px-4 py-2 text-xs font-semibold text-white"
          >
            Define Requirements
          </Link>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2 text-[#22D3EE]">
            <Search className="h-5 w-5" />
            <h2 className="text-base font-bold text-primary-token">Browse Verified Marketplace</h2>
          </div>
          <p className="mt-2 text-sm text-secondary-token">
            Compare verified digital assets side by side across security posture, maintainability,
            and revival effort estimates.
          </p>
          <Link
            href="/dashboard/buyer/discover"
            className="mt-5 inline-flex rounded-xl border border-token bg-elevated px-4 py-2 text-xs font-semibold text-primary-token hover:bg-surface-elevated"
          >
            Discover Assets
          </Link>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}
