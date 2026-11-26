'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatLabel } from '@/lib/api';

interface InquiryRow {
  inquiry: { id: string; subject: string; intendedUse: string; status: string; createdAt: string };
  assetName: string;
  assetCode: string;
}

export default function OwnerInquiriesPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);

  const load = () =>
    apiFetch<{ inquiries: InquiryRow[] }>('/inquiries').then((d) => setInquiries(d.inquiries));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const respond = async (id: string, action: 'accept' | 'decline') => {
    const res = await apiFetch<{ deal?: { id: string } }>(`/inquiries/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    if (res.deal) {
      pushToast('Inquiry accepted — Deal Room opened', 'success');
      router.push(`/dashboard/deals/${res.deal.id}`);
    } else {
      pushToast('Inquiry declined', 'info');
      await load();
    }
  };

  return (
    <DashboardShell
      mode="owner"
      title="Buyer Inquiries"
      subtitle="Review commercial inquiries and accept qualified buyers into structured deal rooms."
    >
      {inquiries.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="No buyer inquiries yet"
          description="Published marketplace listings receive buyer due diligence and licensing inquiries here."
        />
      ) : (
        <div className="space-y-3">
          {inquiries.map((row) => (
            <SurfaceCard key={row.inquiry.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#22D3EE]">{row.assetCode}</span>
                  <span className="text-xs font-semibold text-[#A78BFA]">{formatLabel(row.inquiry.intendedUse)}</span>
                  <StatusBadge status={row.inquiry.status} />
                </div>
                <div className="mt-1 text-base font-bold text-primary-token">{row.inquiry.subject}</div>
                <div className="text-xs text-secondary-token">Asset: {row.assetName}</div>
              </div>
              {row.inquiry.status === 'open' && (
                <div className="flex gap-2">
                  <Button type="button" onClick={() => respond(row.inquiry.id, 'accept')} className="px-3.5 py-1.5 text-xs">
                    Accept &amp; Open Deal Room
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => respond(row.inquiry.id, 'decline')} className="px-3.5 py-1.5 text-xs">
                    Decline
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
