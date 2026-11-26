'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Cpu,
  FileCode2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, ScoreRing, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatMoney } from '@/lib/api';

interface AssetItem {
  id: string;
  name: string;
  assetCode: string;
  primaryLanguage: string | null;
  techStack: string[];
  technicalEvalStatus: string;
}

interface ReportData {
  technicalReport: {
    technicalScore: number;
    maintainabilityScore: number;
    securityScore: number;
    documentationScore: number;
    confidenceLevel: string;
    architectureSummary: string;
    analysisMethods: string[];
    dataSources: string[];
    reusableComponents: string[];
    dependencySummary: Record<string, unknown>;
    knownLimitations: string[];
    createdAt: string;
  } | null;
  commercialReport: {
    reusabilityScore: number;
    commercialOpportunityScore: number;
    estimatedRevivalHoursMin: number;
    estimatedRevivalHoursMax: number;
    estimatedRevivalCostInrMin: number;
    estimatedRevivalCostInrMax: number;
    suggestedValueRangeInrMin: number;
    suggestedValueRangeInrMax: number;
    confidenceLevel: string;
    targetSegments: string[];
    modernizationRequirements: string[];
    documentedAssumptions: string[];
    uncertaintyFactors: string[];
  } | null;
  riskFindings: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    filePath: string | null;
    lineNumber: number | null;
    remediation: string | null;
  }>;
  jobs: Array<{ id: string; status: string; engineMode: string; durationMs: number | null }>;
}

export default function OwnerAnalysisPage() {
  const { pushToast } = useToast();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiFetch<{ assets: AssetItem[] }>('/assets').then((d) => {
      setAssets(d.assets);
      if (d.assets[0]) setSelectedId(d.assets[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    apiFetch<ReportData>(`/assets/${selectedId}/reports`)
      .then(setReport)
      .catch(() => setReport(null));
  }, [selectedId]);

  const triggerAnalysis = async () => {
    if (!selectedId) return;
    setRunning(true);
    try {
      const res = await apiFetch<{ engineMode: string }>(`/assets/${selectedId}/analyze`, {
        method: 'POST',
      });
      pushToast(`Evaluation completed via ${res.engineMode}`, 'success');
      const fresh = await apiFetch<ReportData>(`/assets/${selectedId}/reports`);
      setReport(fresh);
    } catch (err) {
      pushToast((err as Error).message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const selectedAsset = assets.find((a) => a.id === selectedId);
  const tech = report?.technicalReport;
  const comm = report?.commercialReport;
  const scoreChartData = tech
    ? [
      { metric: 'Technical', score: tech.technicalScore },
      { metric: 'Maintainability', score: tech.maintainabilityScore },
      { metric: 'Security', score: tech.securityScore },
      { metric: 'Documentation', score: tech.documentationScore },
      ...(comm ? [{ metric: 'Reusability', score: comm.reusabilityScore }] : []),
    ]
    : [];

  return (
    <DashboardShell
      mode="owner"
      title="AI Technical & Commercial Intelligence"
      subtitle="Transparent AST parsing, secret detection, dependency health, and revival modeling."
    >
      <SurfaceCard className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-[260px] flex-1 items-center gap-3">
          <Cpu className="h-5 w-5 shrink-0 text-[#22D3EE]" />
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="sl-input w-full rounded-xl px-3.5 py-2 text-sm font-medium"
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" loading={running} disabled={!selectedId} onClick={triggerAnalysis}>
          <Sparkles className="h-4 w-4" />
          Run Evaluation Pipeline
        </Button>
      </SurfaceCard>

      {tech ? (
        <div className="mt-6 space-y-6">
          {/* Score Gauges & Dimension Chart */}
          <div className="grid gap-6 lg:grid-cols-12">
            <SurfaceCard className="p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-primary-token">
                    Evaluation Scorecard {selectedAsset ? `• ${selectedAsset.assetCode}` : ''}
                  </h2>
                  <p className="text-xs text-muted-token">
                    Engine: {report?.jobs?.[0]?.engineMode || 'deterministic'} • Confidence:{' '}
                    {Math.round(Number(tech.confidenceLevel) * 100)}%
                  </p>
                </div>
                <span className="rounded-full border border-[#22D3EE]/35 bg-[#22D3EE]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#22D3EE]">
                  {tech.analysisMethods.length} Methods Applied
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <ScoreRing score={tech.technicalScore} label="Technical" color="#8B5CF6" />
                <ScoreRing score={tech.maintainabilityScore} label="Maintainability" color="#60A5FA" />
                <ScoreRing score={tech.securityScore} label="Security" color="#34D399" />
                <ScoreRing score={tech.documentationScore} label="Documentation" color="#22D3EE" />
              </div>

              <p className="mt-6 rounded-xl border border-token bg-elevated p-4 text-xs leading-relaxed text-secondary-token">
                {tech.architectureSummary}
              </p>
            </SurfaceCard>

            <SurfaceCard className="p-6 lg:col-span-5">
              <h2 className="text-sm font-semibold text-primary-token">Capability Profile</h2>
              <p className="text-xs text-muted-token">Multi-axis intelligence breakdown</p>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreChartData} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#A3ADC2' }} />
                    <YAxis type="category" dataKey="metric" width={96} tick={{ fontSize: 11, fill: '#A3ADC2' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141A2B',
                        border: '1px solid #283149',
                        borderRadius: '10px',
                        color: '#F4F6FC',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="score" fill="#22D3EE" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SurfaceCard>
          </div>

          {/* Commercial Revival Intelligence */}
          {comm && (
            <SurfaceCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#34D399]" />
                  <h2 className="text-sm font-semibold text-primary-token">
                    Commercial Opportunity &amp; Revival Modeling
                  </h2>
                </div>
                <span className="text-xs text-muted-token">
                  Commercial Confidence: {Math.round(Number(comm.confidenceLevel) * 100)}%
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-token bg-elevated p-4">
                  <div className="text-xs text-muted-token">Reusability Score</div>
                  <div className="mt-1 text-2xl font-bold text-[#22D3EE]">{comm.reusabilityScore}/100</div>
                </div>
                <div className="rounded-xl border border-token bg-elevated p-4">
                  <div className="text-xs text-muted-token">Opportunity Score</div>
                  <div className="mt-1 text-2xl font-bold text-[#8B5CF6]">{comm.commercialOpportunityScore}/100</div>
                </div>
                <div className="rounded-xl border border-token bg-elevated p-4">
                  <div className="text-xs text-muted-token">Est. Revival Effort</div>
                  <div className="mt-1 text-lg font-bold text-primary-token">
                    {comm.estimatedRevivalHoursMin}–{comm.estimatedRevivalHoursMax} hrs
                  </div>
                </div>
                <div className="rounded-xl border border-token bg-elevated p-4">
                  <div className="text-xs text-muted-token">Suggested Value Range</div>
                  <div className="mt-1 text-sm font-bold text-[#34D399]">
                    {formatMoney(comm.suggestedValueRangeInrMin)} – {formatMoney(comm.suggestedValueRangeInrMax)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-token bg-elevated p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-token">
                    Documented Assumptions
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-secondary-token">
                    {comm.documentedAssumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/8 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">
                    Uncertainty &amp; Limitations
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-secondary-token">
                    {[...comm.uncertaintyFactors, ...tech.knownLimitations].map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </SurfaceCard>
          )}

          {/* Expandable Risk & Security Findings */}
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#FBBF24]" />
                <h2 className="text-sm font-semibold text-primary-token">
                  Security, Secret &amp; Dependency Findings ({report?.riskFindings.length || 0})
                </h2>
              </div>
              <span className="text-xs text-muted-token">
                Dependencies tracked: {String(tech.dependencySummary?.totalDependencies ?? 0)}
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {!report?.riskFindings.length ? (
                <p className="text-xs text-secondary-token">No security or secret findings flagged in this snapshot.</p>
              ) : (
                report.riskFindings.map((f) => {
                  const open = expandedFinding === f.id;
                  return (
                    <div key={f.id} className="rounded-xl border border-token bg-elevated">
                      <button
                        type="button"
                        onClick={() => setExpandedFinding(open ? null : f.id)}
                        className="flex w-full items-center justify-between gap-3 p-3.5 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <StatusBadge status={f.severity} />
                          <span className="text-sm font-semibold text-primary-token">{f.title}</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-token transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <div className="border-t border-token px-4 py-3 text-xs text-secondary-token space-y-1.5">
                          <p>{f.description}</p>
                          {f.filePath && (
                            <div className="font-mono text-[11px] text-[#22D3EE]">
                              File: {f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}
                            </div>
                          )}
                          {f.remediation && (
                            <div className="text-[#34D399]">
                              <strong>Remediation:</strong> {f.remediation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </SurfaceCard>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<FileCode2 className="h-6 w-6" />}
            title="No Evaluation Report Generated Yet"
            description="Select an asset above and launch the static & commercial intelligence pipeline."
            action={
              <Button type="button" loading={running} disabled={!selectedId} onClick={triggerAnalysis}>
                Run Evaluation Pipeline
              </Button>
            }
          />
        </div>
      )}
    </DashboardShell>
  );
}
