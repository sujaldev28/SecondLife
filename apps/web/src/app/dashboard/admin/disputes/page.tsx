'use client';

import { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatLabel } from '@/lib/api';

interface DisputeRow {
  id: string;
  assetName: string;
  disputeType: string;
  severity: string;
  description: string;
  status: string;
}

export default function AdminDisputesPage() {
  const { pushToast } = useToast();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);

  const load = () =>
    apiFetch<{ disputes: DisputeRow[] }>('/disputes').then((d) => setDisputes(d.disputes));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const resolve = async (id: string, status: 'resolved_upheld' | 'resolved_dismissed') => {
    await apiFetch(`/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        resolutionNotes: `Compliance team resolved dispute as ${status}.`,
        restoreListing: status === 'resolved_dismissed',
      }),
    });
    pushToast(`Dispute ${formatLabel(status)}`, 'info');
    await load();
  };

  return (
    <DashboardShell mode="admin" title="Disputes & Takedown Queue" subtitle="Investigate IP ownership disputes and license complaints.">
      {disputes.length === 0 ? (
        <EmptyState
          icon={<Gavel className="h-6 w-6" />}
          title="No active disputes"
          description="Ownership or license disputes filed on marketplace assets appear here."
        />
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <SurfaceCard key={d.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.severity} />
                  <span className="text-xs font-semibold text-[#22D3EE]">{formatLabel(d.disputeType)}</span>
                  <StatusBadge status={d.status} />
                </div>
                {d.status === 'open' && (
                  <div className="flex gap-2">
                    <Button type="button" variant="destructive" onClick={() => resolve(d.id, 'resolved_upheld')} className="px-3 py-1 text-xs">Uphold Takedown</Button>
                    <Button type="button" variant="secondary" onClick={() => resolve(d.id, 'resolved_dismissed')} className="px-3 py-1 text-xs">Dismiss &amp; Restore</Button>
                  </div>
                )}
              </div>
              <div className="mt-2 font-bold text-primary-token">{d.assetName}</div>
              <p className="mt-1 text-sm text-secondary-token">{d.description}</p>
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
