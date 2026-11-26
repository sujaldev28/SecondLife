'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

interface AdminAssetRow {
  asset: {
    id: string;
    assetCode: string;
    name: string;
    lifecycleStatus: string;
    verificationStatus: string;
    technicalEvalStatus: string;
  };
  organizationName: string;
}

export default function AdminAssetsPage() {
  const [rows, setRows] = useState<AdminAssetRow[]>([]);

  useEffect(() => {
    apiFetch<{ assets: AdminAssetRow[] }>('/admin/assets').then((d) => setRows(d.assets)).catch(() => {});
  }, []);

  return (
    <DashboardShell mode="admin" title="Platform Asset Registry" subtitle="Cross-tenant overview of registered digital assets.">
      <SurfaceCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-token bg-elevated text-xs text-muted-token">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Verification</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.asset.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                  <td className="px-4 py-3 font-mono text-xs text-[#22D3EE]">{r.asset.assetCode}</td>
                  <td className="px-4 py-3 font-semibold text-primary-token">{r.asset.name}</td>
                  <td className="px-4 py-3 text-xs text-secondary-token">{r.organizationName}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.asset.lifecycleStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.asset.verificationStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </DashboardShell>
  );
}
