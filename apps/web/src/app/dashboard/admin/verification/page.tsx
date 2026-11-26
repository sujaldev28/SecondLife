'use client';

import { useEffect, useState } from 'react';
import { FileCheck } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

interface QueueRow {
  requestId: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  declaredLicense: string;
  status: string;
  ipConflictFlag: boolean;
  licenseRiskLevel: string;
}

export default function AdminVerificationPage() {
  const { pushToast } = useToast();
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [notes, setNotes] = useState('Ownership attestation and license compatibility verified.');

  const load = () =>
    apiFetch<{ queue: QueueRow[] }>('/verification/queue').then((d) => setQueue(d.queue));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const decide = async (requestId: string, decision: 'approved' | 'rejected' | 'changes_requested') => {
    await apiFetch(`/verification/${requestId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewerNotes: notes, ipConflictFlag: false }),
    });
    pushToast(`Verification request ${decision}`, 'success');
    await load();
  };

  return (
    <DashboardShell
      mode="admin"
      title="Verification & IP Compliance Queue"
      subtitle="Review ownership declarations, contributor disclosures, and copyleft license flags."
    >
      <SurfaceCard className="mb-4 p-4">
        <label className="block text-xs font-medium text-secondary-token">Reviewer Decision Notes</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
        />
      </SurfaceCard>

      {queue.length === 0 ? (
        <EmptyState
          icon={<FileCheck className="h-6 w-6" />}
          title="Verification queue is clear"
          description="Submitted ownership declarations awaiting compliance review will appear here."
        />
      ) : (
        <div className="space-y-3">
          {queue.map((q) => (
            <SurfaceCard key={q.requestId} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#22D3EE]">{q.assetCode}</span>
                  <StatusBadge status={q.status} />
                  <StatusBadge status={q.licenseRiskLevel} />
                </div>
                <div className="mt-1 text-base font-bold text-primary-token">{q.assetName}</div>
                <div className="text-xs text-secondary-token">
                  License: {q.declaredLicense} • IP Conflict Flag: {q.ipConflictFlag ? 'Yes' : 'No'}
                </div>
              </div>

              {q.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => decide(q.requestId, 'approved')} className="px-3 py-1.5 text-xs">
                    Approve
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => decide(q.requestId, 'changes_requested')} className="px-3 py-1.5 text-xs">
                    Request Changes
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => decide(q.requestId, 'rejected')} className="px-3 py-1.5 text-xs">
                    Reject
                  </Button>
                </div>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
