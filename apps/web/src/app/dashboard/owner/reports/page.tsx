'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

interface AssetItem {
  id: string;
  assetCode: string;
  name: string;
  technicalEvalStatus: string;
  commercialEvalStatus: string;
  verificationStatus: string;
}

export default function OwnerReportsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);

  useEffect(() => {
    apiFetch<{ assets: AssetItem[] }>('/assets').then((d) => setAssets(d.assets)).catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="owner"
      title="Evaluation & Compliance Reports"
      subtitle="Portfolio status of technical, commercial, and verification reports."
    >
      <div className="space-y-3">
        {assets.map((a) => (
          <SurfaceCard key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="font-mono text-xs text-[#22D3EE]">{a.assetCode}</div>
              <div className="text-base font-bold text-primary-token">{a.name}</div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={a.technicalEvalStatus} />
              <StatusBadge status={a.verificationStatus} />
              <Link
                href="/dashboard/owner/analysis"
                className="rounded-xl border border-token bg-elevated px-3.5 py-1.5 text-xs font-semibold text-primary-token hover:bg-surface-elevated"
              >
                Inspect Reports
              </Link>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </DashboardShell>
  );
}
