'use client';

import { useEffect, useState } from 'react';
import { Activity, FileCheck2, FolderGit2, Gavel, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardShell } from '@/components/DashboardShell';
import { KpiCard, SkeletonCard, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface OverviewMetrics {
  totalUsers: number;
  totalOrganizations: number;
  totalAssets: number;
  assetsByStatus: Record<string, number>;
  pendingVerifications: number;
  openDisputes: number;
  totalDeals: number;
  totalGmvMinor: number;
  totalCommissionMinor: number;
  aiJobsTotal: number;
  aiJobsFailed: number;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ metrics: OverviewMetrics }>('/admin/overview')
      .then((d) => setMetrics(d.metrics))
      .catch((e) => setError(e.message));
  }, []);

  const chartData = metrics
    ? Object.entries(metrics.assetsByStatus).map(([status, count]) => ({
      status: formatLabel(status),
      count,
    }))
    : [];

  return (
    <DashboardShell
      mode="admin"
      title="Platform Governance & Operations Overview"
      subtitle="Live platform telemetry across identity, compliance queues, AI analysis jobs, and transaction GMV."
    >
      {error ? (
        <SurfaceCard className="border-[#FB7185]/35 p-6 text-sm text-[#FB7185]">{error}</SurfaceCard>
      ) : !metrics ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Users / Orgs" value={`${metrics.totalUsers} / ${metrics.totalOrganizations}`} accent="indigo" icon={<Users className="h-4 w-4" />} />
            <KpiCard label="Registered Assets" value={metrics.totalAssets} accent="violet" icon={<FolderGit2 className="h-4 w-4" />} />
            <KpiCard label="Pending Reviews" value={metrics.pendingVerifications} accent="amber" icon={<FileCheck2 className="h-4 w-4" />} />
            <KpiCard label="Open Disputes" value={metrics.openDisputes} accent="magenta" icon={<Gavel className="h-4 w-4" />} />
            <KpiCard label="Settled GMV" value={formatMoney(metrics.totalGmvMinor)} accent="cyan" icon={<Wallet className="h-4 w-4" />} />
            <KpiCard label="Commission Revenue" value={formatMoney(metrics.totalCommissionMinor)} accent="emerald" icon={<Activity className="h-4 w-4" />} />
          </div>

          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-primary-token">Asset Lifecycle Distribution</h2>
                <p className="text-xs text-muted-token">Platform-wide state breakdown</p>
              </div>
              <span className="text-xs text-secondary-token">
                AI Jobs: {metrics.aiJobsTotal} ({metrics.aiJobsFailed} failed)
              </span>
            </div>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#A3ADC2' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#A3ADC2' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141A2B',
                      border: '1px solid #283149',
                      borderRadius: '10px',
                      color: '#F4F6FC',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#22D3EE" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SurfaceCard>
        </div>
      )}
    </DashboardShell>
  );
}
