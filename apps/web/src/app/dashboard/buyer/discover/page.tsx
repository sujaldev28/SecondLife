'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface Listing {
  listingId: string;
  title: string;
  summary: string;
  listingType: string;
  askingPriceMinor: number;
  currency: string;
  primaryLanguage: string | null;
  technicalScore: number | null;
  verificationStatus: string;
}

export default function BuyerDiscoverPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [q, setQ] = useState('');

  const search = () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    apiFetch<{ listings: Listing[] }>(`/marketplace/listings?${p.toString()}`)
      .then((d) => setListings(d.listings))
      .catch(() => {});
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardShell
      mode="buyer"
      title="Discover Verified Assets"
      subtitle="Search active marketplace listings directly from your sourcing workspace."
    >
      <SurfaceCard className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute top-3 left-3 h-4 w-4 text-muted-token" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search TypeScript, Python, FinTech, DevOps..."
              className="sl-input w-full rounded-xl py-2.5 pr-3 pl-9 text-sm"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </SurfaceCard>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {listings.map((l) => (
          <SurfaceCard key={l.listingId} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#22D3EE]">{formatLabel(l.listingType)}</span>
              <StatusBadge status={l.verificationStatus} />
            </div>
            <h3 className="mt-2 text-base font-bold text-primary-token">{l.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-secondary-token">{l.summary}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm font-bold text-primary-token">
                {formatMoney(l.askingPriceMinor, l.currency)} •{' '}
                <span className="text-[#34D399]">Tech {l.technicalScore ?? '—'}/100</span>
              </div>
              <Link href={`/assets/${l.listingId}`} className="sl-gradient-primary rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white">
                Inspect &amp; Inquire
              </Link>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </DashboardShell>
  );
}
