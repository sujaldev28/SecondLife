'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FolderGit2, Plus } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, SkeletonCard, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  assetType: string;
  primaryLanguage: string | null;
  lifecycleStatus: string;
  technicalEvalStatus: string;
  verificationStatus: string;
}

export default function OwnerAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ assets: Asset[] }>('/assets')
      .then((d) => setAssets(d.assets))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell
      mode="owner"
      title="My Digital Assets"
      subtitle="Organization-scoped registry of submitted codebases, models, and products."
    >
      <div className="mb-4 flex justify-end">
        <Link
          href="/dashboard/owner/submit"
          className="sl-gradient-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Submit New Asset
        </Link>
      </div>

      {loading ? (
        <SkeletonCard className="h-64" />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<FolderGit2 className="h-6 w-6" />}
          title="No assets in this workspace"
          description="Submit a repository URL or ZIP archive to start evaluation and verification."
          action={
            <Link href="/dashboard/owner/submit" className="sl-gradient-primary rounded-xl px-4 py-2 text-xs font-semibold text-white">
              Submit Asset
            </Link>
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-token bg-elevated text-xs text-muted-token">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Asset Name</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Lifecycle</th>
                  <th className="px-4 py-3">Analysis</th>
                  <th className="px-4 py-3">Verification</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                    <td className="px-4 py-3 font-mono text-xs text-[#22D3EE]">{a.assetCode}</td>
                    <td className="px-4 py-3 font-semibold text-primary-token">{a.name}</td>
                    <td className="px-4 py-3 text-secondary-token">{a.primaryLanguage || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.lifecycleStatus} /></td>
                    <td className="px-4 py-3"><StatusBadge status={a.technicalEvalStatus} /></td>
                    <td className="px-4 py-3"><StatusBadge status={a.verificationStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </DashboardShell>
  );
}
