'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel } from '@/lib/api';

interface InquiryRow {
  inquiry: { id: string; subject: string; intendedUse: string; status: string };
  assetName: string;
}

export default function BuyerInquiriesPage() {
  const [rows, setRows] = useState<InquiryRow[]>([]);

  useEffect(() => {
    apiFetch<{ inquiries: InquiryRow[] }>('/inquiries').then((d) => setRows(d.inquiries)).catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="buyer"
      title="Submitted Inquiries"
      subtitle="Track owner responses and conversion into active deal rooms."
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="No inquiries submitted yet"
          description="Submit an inquiry from any verified Marketplace asset detail page."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <SurfaceCard key={r.inquiry.id} className="flex items-center justify-between p-5">
              <div>
                <div className="text-base font-bold text-primary-token">{r.inquiry.subject}</div>
                <div className="text-xs text-secondary-token">
                  {r.assetName} • {formatLabel(r.inquiry.intendedUse)}
                </div>
              </div>
              <StatusBadge status={r.inquiry.status} />
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
