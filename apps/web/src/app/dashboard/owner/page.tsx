'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  Briefcase,
  CheckCircle2,
  Compass,
  FileCheck2,
  FolderGit2,
  Plus,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, KpiCard, SurfaceCard } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatLabel } from '@/lib/api';

interface AssetRow {
  id: string;
  assetCode: string;
  name: string;
  lifecycleStatus: string;
  verificationStatus: string;
  technicalEvalStatus: string;
  marketplaceStatus: string;
  primaryLanguage: string | null;
}

interface Candidate {
  id: string;
  repoFullName: string;
  primaryLanguage: string | null;
  inactivityDays: number;
  candidateScore: number;
  status: string;
}

interface InquiryRow {
  inquiry: { id: string; subject: string; status: string };
  assetName: string;
}

interface DealRow {
  deal: { id: string; status: string };
}

interface TxnRow {
  transaction: { id: string; status: string };
}

const PIE_COLORS = ['#8B5CF6', '#22D3EE', '#34D399', '#FBBF24', '#60A5FA'];

export default function OwnerOverviewPage() {
  const { user, organizations, activeOrganizationId } = useAuth();
  const { pushToast } = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [scanQuery, setScanQuery] = useState('fastapi');
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    const [a, c, inq, d, t] = await Promise.all([
      apiFetch<{ assets: AssetRow[] }>('/assets').catch(() => ({ assets: [] })),
      apiFetch<{ candidates: Candidate[] }>('/discovery/candidates').catch(() => ({ candidates: [] })),
      apiFetch<{ inquiries: InquiryRow[] }>('/inquiries').catch(() => ({ inquiries: [] })),
      apiFetch<{ deals: DealRow[] }>('/deals').catch(() => ({ deals: [] })),
      apiFetch<{ transactions: TxnRow[] }>('/transactions').catch(() => ({ transactions: [] })),
    ]);
    setAssets(a.assets);
    setCandidates(c.candidates);
    setInquiries(inq.inquiries);
    setDeals(d.deals);
    setTxns(t.transactions);
  };

  useEffect(() => {
    load();
  }, []);

  const runDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanning(true);
    try {
      const res = await apiFetch<{ candidatesFound: number }>('/discovery/scan', {
        method: 'POST',
        body: JSON.stringify({ query: scanQuery, minInactivityDays: 180, limit: 5 }),
      });
      pushToast(`Flagged ${res.candidatesFound} candidate repositories for review`, 'info');
      await load();
    } catch (err) {
      pushToast((err as Error).message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const importCandidate = async (id: string) => {
    await apiFetch(`/discovery/candidates/${id}/import`, { method: 'POST' });
    pushToast('Candidate imported into verification pipeline', 'success');
    await load();
  };

  const activeOrg = organizations.find((o) => o.organizationId === activeOrganizationId);

  const lifecycleCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.lifecycleStatus] = (acc[a.lifecycleStatus] || 0) + 1;
    return acc;
  }, {});
  const lifecycleChartData = Object.entries(lifecycleCounts).map(([status, count]) => ({
    status: formatLabel(status),
    count,
  }));

  const languageCounts = assets.reduce<Record<string, number>>((acc, a) => {
    const lang = a.primaryLanguage || 'Other';
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {});
  const languagePieData = Object.entries(languageCounts).map(([name, value]) => ({ name, value }));

  const underAnalysisCount = assets.filter(
    (a) => a.technicalEvalStatus !== 'completed' || a.lifecycleStatus === 'under_analysis',
  ).length;
  const verifiedCount = assets.filter((a) => a.verificationStatus === 'verified').length;
  const publishedCount = assets.filter((a) => a.marketplaceStatus === 'published').length;
  const activeDealsCount = deals.filter((d) => !['completed', 'cancelled'].includes(d.deal.status)).length;
  const completedTxnCount = txns.filter((t) => ['captured', 'settled'].includes(t.transaction.status)).length;
  const pendingVerifications = assets.filter((a) => a.verificationStatus !== 'verified');

  return (
    <DashboardShell
      mode="owner"
      title={`Welcome back, ${user?.fullName.split(' ')[0] || 'Creator'}`}
      subtitle={`${activeOrg?.organizationName || 'Personal Workspace'} — Monitor asset evaluation, verification gates, and deal pipeline.`}
    >
      {/* Quick Action Banner */}
      <SurfaceCard className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#22D3EE] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-primary-token">Intelligent Digital Revival Console</div>
            <div className="text-xs text-secondary-token">
              Submit source code, inspect static &amp; commercial intelligence, and publish verified listings.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/owner/submit"
            className="sl-gradient-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Submit Asset
          </Link>
          <Link
            href="/dashboard/owner/analysis"
            className="inline-flex items-center gap-1.5 rounded-lg border border-token bg-surface-elevated px-4 py-2 text-xs font-semibold text-primary-token hover:bg-[var(--surface-hover)]"
          >
            <Activity className="h-3.5 w-3.5 text-[#22D3EE]" />
            Run Analysis
          </Link>
        </div>
      </SurfaceCard>

      {/* 6 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Assets" value={assets.length} accent="violet" icon={<FolderGit2 className="h-4 w-4" />} />
        <KpiCard label="Under Analysis" value={underAnalysisCount} accent="cyan" icon={<Activity className="h-4 w-4" />} />
        <KpiCard label="Verified Assets" value={verifiedCount} accent="emerald" icon={<FileCheck2 className="h-4 w-4" />} />
        <KpiCard label="Published Listings" value={publishedCount} accent="indigo" icon={<Store className="h-4 w-4" />} />
        <KpiCard label="Active Deals" value={activeDealsCount} accent="magenta" icon={<Briefcase className="h-4 w-4" />} />
        <KpiCard label="Settled Txns" value={completedTxnCount} accent="amber" icon={<Wallet className="h-4 w-4" />} />
      </div>

      {/* Analytics Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <SurfaceCard className="p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-primary-token">Asset Lifecycle Pipeline</h2>
              <p className="text-xs text-muted-token">Distribution across workflow states</p>
            </div>
          </div>
          <div className="mt-4 h-60 w-full">
            {lifecycleChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-token">
                Submit an asset to visualize lifecycle distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lifecycleChartData}>
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
                  <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6 lg:col-span-5">
          <h2 className="text-sm font-semibold text-primary-token">Stack Distribution</h2>
          <p className="text-xs text-muted-token">Primary languages across portfolio</p>
          <div className="mt-4 h-60 w-full">
            {languagePieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-token">
                No language telemetry available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languagePieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={82}
                    paddingAngle={4}
                  >
                    {languagePieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141A2B',
                      border: '1px solid #283149',
                      borderRadius: '10px',
                      color: '#F4F6FC',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SurfaceCard>
      </div>

      {/* Portfolio Lists & Discovery Engine */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SurfaceCard className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary-token">Recent Assets &amp; Verification Queue</h2>
            <Link href="/dashboard/owner/assets" className="text-xs font-semibold text-[#22D3EE] hover:underline">
              View All
            </Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {assets.length === 0 ? (
              <p className="text-xs text-muted-token">No assets submitted yet.</p>
            ) : (
              assets.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-token bg-elevated p-3">
                  <div>
                    <div className="text-sm font-semibold text-primary-token">{a.name}</div>
                    <div className="font-mono text-[11px] text-muted-token">{a.assetCode}</div>
                  </div>
                  <StatusBadge status={a.lifecycleStatus} />
                </div>
              ))
            )}
          </div>

          {pendingVerifications.length > 0 && (
            <div className="mt-4 rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-3 text-xs text-[#FBBF24]">
              <div className="flex items-center justify-between">
                <span>
                  {pendingVerifications.length} asset(s) require ownership verification before publishing.
                </span>
                <Link href="/dashboard/owner/verification" className="font-semibold underline">
                  Verify Now →
                </Link>
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#22D3EE]" />
            <h2 className="text-sm font-semibold text-primary-token">Discovery Candidate Engine</h2>
          </div>
          <p className="mt-1 text-xs text-secondary-token">
            Flag inactive public repositories as candidates. Inactivity never proves ownership or abandonment.
          </p>

          <form onSubmit={runDiscovery} className="mt-3 flex gap-2">
            <input
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              placeholder="Topic or keyword (e.g., invoicing)"
              className="sl-input flex-1 rounded-xl px-3 py-2 text-xs"
            />
            <Button type="submit" loading={scanning} className="px-4 py-2 text-xs">
              Scan
            </Button>
          </form>

          <div className="mt-4 space-y-2.5">
            {candidates.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-token bg-elevated p-3 text-xs">
                <div>
                  <div className="font-semibold text-primary-token">{c.repoFullName}</div>
                  <div className="text-muted-token">
                    {c.primaryLanguage || 'Mixed'} • {c.inactivityDays}d inactive • Candidate Score {c.candidateScore}
                  </div>
                </div>
                {c.status === 'candidate' ? (
                  <button
                    type="button"
                    onClick={() => importCandidate(c.id)}
                    className="rounded-lg border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-2.5 py-1 font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20 cursor-pointer"
                  >
                    Import
                  </button>
                ) : (
                  <StatusBadge status={c.status} />
                )}
              </div>
            ))}
          </div>

          {inquiries.length > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#34D399]/30 bg-[#34D399]/10 p-3 text-xs text-[#34D399]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {inquiries.length} buyer inquiry record(s) in queue
              </span>
              <Link href="/dashboard/owner/inquiries" className="font-semibold underline">
                Review Inquiries →
              </Link>
            </div>
          )}
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}
