'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bookmark, CheckCircle2, Lock, Send, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, ScoreRing, SkeletonCard, SurfaceCard } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface DetailPayload {
  listing: {
    id: string;
    title: string;
    summary: string;
    listingType: string;
    currency: string;
    askingPriceMinor: number;
    commercialTerms: string;
    supportIncludedDays: number;
    exclusivityAvailable: boolean;
  };
  asset: {
    id: string;
    assetCode: string;
    name: string;
    description: string;
    primaryLanguage: string | null;
    techStack: string[];
    declaredLicense: string;
    verificationStatus: string;
    isDemoSeed: boolean;
  };
  category: { name: string };
  ownerOrganizationName: string;
  technicalReport: {
    technicalScore: number;
    maintainabilityScore: number;
    securityScore: number;
    documentationScore: number;
    confidenceLevel: string;
    architectureSummary: string;
    analysisMethods: string[];
    knownLimitations: string[];
  } | null;
  commercialReport: {
    reusabilityScore: number;
    commercialOpportunityScore: number;
    estimatedRevivalHoursMin: number;
    estimatedRevivalHoursMax: number;
    estimatedRevivalCostInrMin: number;
    estimatedRevivalCostInrMax: number;
    documentedAssumptions: string[];
    uncertaintyFactors: string[];
  } | null;
  similarListings?: Array<{
    listingId: string;
    title: string;
    listingType: string;
    askingPriceMinor: number;
    currency: string;
  }>;
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [intendedUse, setIntendedUse] = useState('license');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiFetch<DetailPayload>(`/marketplace/listings/${params.id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params.id]);

  const handleSave = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!data) return;
    await apiFetch('/saved-assets', {
      method: 'POST',
      body: JSON.stringify({ assetId: data.asset.id }),
    });
    pushToast('Asset saved to your shortlist', 'success');
  };

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!data) return;
    setSending(true);
    try {
      await apiFetch('/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          assetId: data.asset.id,
          listingId: data.listing.id,
          subject,
          message,
          intendedUse,
        }),
      });
      setSubject('');
      setMessage('');
      pushToast('Buyer inquiry submitted! Track responses in Buyer Console.', 'success');
    } catch (err) {
      pushToast((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 animate-sl-in">
        {error ? (
          <SurfaceCard className="border-[#FB7185]/40 p-6 text-sm text-[#FB7185]">{error}</SurfaceCard>
        ) : !data ? (
          <SkeletonCard className="h-96" />
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <SurfaceCard className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#22D3EE]">{data.category.name}</span>
                  <span className="text-muted-token">•</span>
                  <span className="font-mono text-xs text-muted-token">{data.asset.assetCode}</span>
                  <StatusBadge status={data.asset.verificationStatus} />
                  {data.asset.isDemoSeed && (
                    <span className="rounded-md border border-token bg-elevated px-2 py-0.5 text-[11px] text-muted-token">
                      Development Demo Asset
                    </span>
                  )}
                </div>

                <h1 className="mt-3 text-2xl font-bold text-primary-token sm:text-3xl">
                  {data.listing.title}
                </h1>
                <p className="mt-2 text-xs text-secondary-token">
                  Owner Org: <strong className="text-primary-token">{data.ownerOrganizationName}</strong> •
                  License: <strong className="text-primary-token">{data.asset.declaredLicense}</strong>
                </p>

                <p className="mt-5 text-sm leading-relaxed text-secondary-token">
                  {data.asset.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {data.asset.techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-lg border border-token bg-elevated px-2.5 py-1 text-xs font-medium text-primary-token"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2 rounded-xl border border-[#60A5FA]/30 bg-[#60A5FA]/8 px-4 py-3 text-xs text-[#60A5FA]">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>
                    Public listing summary shown. Private source archives, file-level secret findings,
                    and contributor records are shared only under authorized due diligence.
                  </span>
                </div>
              </SurfaceCard>

              {data.technicalReport && (
                <SurfaceCard className="p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-primary-token">Technical Intelligence Report</h2>
                    <span className="text-xs text-muted-token">
                      Confidence: {Math.round(Number(data.technicalReport.confidenceLevel) * 100)}%
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                    <ScoreRing score={data.technicalReport.technicalScore} label="Technical" color="#8B5CF6" />
                    <ScoreRing score={data.technicalReport.maintainabilityScore} label="Maintainability" color="#60A5FA" />
                    <ScoreRing score={data.technicalReport.securityScore} label="Security" color="#34D399" />
                    <ScoreRing score={data.technicalReport.documentationScore} label="Documentation" color="#22D3EE" />
                  </div>

                  <p className="mt-6 rounded-xl border border-token bg-elevated p-4 text-xs leading-relaxed text-secondary-token">
                    {data.technicalReport.architectureSummary}
                  </p>

                  <div className="mt-3 rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-3 text-xs text-[#FBBF24]">
                    <strong>Evaluation Limitations:</strong> {data.technicalReport.knownLimitations.join(' ')}
                  </div>
                </SurfaceCard>
              )}

              {data.commercialReport && (
                <SurfaceCard className="p-6">
                  <h2 className="text-base font-bold text-primary-token">
                    Commercial &amp; Revival Assessment
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-token bg-elevated p-4">
                      <div className="text-xs text-muted-token">Reusability Score</div>
                      <div className="mt-1 text-2xl font-bold text-[#22D3EE]">
                        {data.commercialReport.reusabilityScore}/100
                      </div>
                    </div>
                    <div className="rounded-xl border border-token bg-elevated p-4">
                      <div className="text-xs text-muted-token">Revival Effort</div>
                      <div className="mt-1 text-xl font-bold text-primary-token">
                        {data.commercialReport.estimatedRevivalHoursMin}–
                        {data.commercialReport.estimatedRevivalHoursMax} hrs
                      </div>
                    </div>
                    <div className="rounded-xl border border-token bg-elevated p-4">
                      <div className="text-xs text-muted-token">Est. Revival Budget</div>
                      <div className="mt-1 text-sm font-bold text-[#34D399]">
                        {formatMoney(data.commercialReport.estimatedRevivalCostInrMin)} –{' '}
                        {formatMoney(data.commercialReport.estimatedRevivalCostInrMax)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-token bg-elevated p-4">
                      <h3 className="text-xs font-semibold uppercase text-muted-token">
                        Documented Assumptions
                      </h3>
                      <ul className="mt-2 space-y-1.5 text-xs text-secondary-token">
                        {data.commercialReport.documentedAssumptions.map((a) => (
                          <li key={a} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34D399]" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-token bg-elevated p-4">
                      <h3 className="text-xs font-semibold uppercase text-muted-token">
                        Uncertainty Factors
                      </h3>
                      <ul className="mt-2 space-y-1.5 text-xs text-secondary-token">
                        {data.commercialReport.uncertaintyFactors.map((u) => (
                          <li key={u}>• {u}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </SurfaceCard>
              )}
            </div>

            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">
                  {formatLabel(data.listing.listingType)}
                </div>
                <div className="mt-1 text-3xl font-bold text-primary-token tabular-nums">
                  {formatMoney(data.listing.askingPriceMinor, data.listing.currency)}
                </div>
                <p className="mt-3 text-sm text-secondary-token">{data.listing.commercialTerms}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#34D399]">
                  <ShieldCheck className="h-4 w-4" />
                  Includes {data.listing.supportIncludedDays} days onboarding support
                </div>

                <Button type="button" variant="secondary" onClick={handleSave} className="mt-5 w-full">
                  <Bookmark className="h-4 w-4" />
                  Save Asset to Shortlist
                </Button>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <form onSubmit={handleInquiry} className="space-y-3.5">
                  <h3 className="text-base font-bold text-primary-token">Submit Buyer Inquiry</h3>
                  <p className="text-xs text-secondary-token">
                    Initiate due diligence or negotiate terms inside a private deal room.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-secondary-token">Intended Use</label>
                    <select
                      value={intendedUse}
                      onChange={(e) => setIntendedUse(e.target.value)}
                      className="sl-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="license">Commercial License</option>
                      <option value="acquisition">Full IP Acquisition</option>
                      <option value="revival">Revival Partnership</option>
                      <option value="repurposing">Repurposing Partnership</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-token">Subject</label>
                    <input
                      required
                      minLength={4}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Enterprise License & Due Diligence"
                      className="sl-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-token">Message</label>
                    <textarea
                      required
                      minLength={10}
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your integration timeline and licensing questions..."
                      className="sl-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <Button type="submit" loading={sending} className="w-full py-2.5">
                    <Send className="h-4 w-4" />
                    {user ? 'Send Inquiry' : 'Sign in to Inquire'}
                  </Button>
                </form>
              </SurfaceCard>

              <Link
                href="/explore"
                className="block text-center text-xs font-semibold text-[#22D3EE] hover:underline"
              >
                ← Back to Marketplace
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
