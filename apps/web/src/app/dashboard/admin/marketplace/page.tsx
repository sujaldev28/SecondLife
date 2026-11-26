'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatMoney } from '@/lib/api';

interface ListingRow {
  listing: {
    id: string;
    title: string;
    askingPriceMinor: number;
    currency: string;
    status: string;
    moderationStatus: string;
  };
  assetCode: string;
}

export default function AdminMarketplacePage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<ListingRow[]>([]);

  const load = () =>
    apiFetch<{ listings: ListingRow[] }>('/admin/marketplace').then((d) => setRows(d.listings));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const moderate = async (id: string, action: 'approve' | 'suspend') => {
    await apiFetch(`/admin/marketplace/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason: `Admin moderation action: ${action}` }),
    });
    pushToast(`Listing ${action}d`, 'info');
    await load();
  };

  return (
    <DashboardShell mode="admin" title="Marketplace Moderation" subtitle="Approve or suspend active marketplace listings.">
      <div className="space-y-3">
        {rows.map((r) => (
          <SurfaceCard key={r.listing.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#22D3EE]">{r.assetCode}</span>
                <StatusBadge status={r.listing.status} />
                <StatusBadge status={r.listing.moderationStatus} />
              </div>
              <div className="mt-1 text-base font-bold text-primary-token">{r.listing.title}</div>
              <div className="text-xs text-secondary-token">{formatMoney(r.listing.askingPriceMinor, r.listing.currency)}</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => moderate(r.listing.id, 'approve')} className="px-3 py-1.5 text-xs">Approve</Button>
              <Button type="button" variant="destructive" onClick={() => moderate(r.listing.id, 'suspend')} className="px-3 py-1.5 text-xs">Suspend</Button>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </DashboardShell>
  );
}
