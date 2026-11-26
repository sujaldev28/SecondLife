'use client';

import { useEffect, useState } from 'react';
import { Activity, Briefcase, FolderGit2, Wallet } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatMoney } from '@/lib/api';

interface JobRow {
  job: { id: string; status: string; engineMode: string; durationMs: number | null; createdAt: string };
  assetName: string;
}

export default function AdminAnalyticsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ jobs: JobRow[] }>('/admin/ai-jobs').catch(() => ({ jobs: [] })),
      apiFetch<{ metrics: Record<string, unknown> }>('/admin/overview').catch(() => ({ metrics: null })),
    ]).then(([j, m]) => {
      setJobs(j.jobs);
      setMetrics(m.metrics);
    });
  }, []);

  return (
    <DashboardShell
      mode="admin"
      title="Business Analytics & AI Job Monitoring"
      subtitle="Monitor platform commercial KPIs alongside AI analyzer execution health."
    >
      {metrics && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Assets" value={String(metrics.totalAssets)} accent="violet" icon={<FolderGit2 className="h-4 w-4" />} />
          <KpiCard label="Total Deals" value={String(metrics.totalDeals)} accent="cyan" icon={<Briefcase className="h-4 w-4" />} />
          <KpiCard label="AI Jobs Executed" value={String(metrics.aiJobsTotal)} accent="magenta" icon={<Activity className="h-4 w-4" />} />
          <KpiCard label="Commission Revenue" value={formatMoney(Number(metrics.totalCommissionMinor))} accent="emerald" icon={<Wallet className="h-4 w-4" />} />
        </div>
      )}

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-token px-5 py-3.5 text-sm font-bold text-primary-token">
          Recent AI Analysis Jobs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-token bg-elevated text-xs text-muted-token">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Engine Mode</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                  <td className="px-4 py-3 font-semibold text-primary-token">{j.assetName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#22D3EE]">{j.job.engineMode}</td>
                  <td className="px-4 py-3 text-xs text-secondary-token tabular-nums">{j.job.durationMs ? `${j.job.durationMs} ms` : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={j.job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </DashboardShell>
  );
}
