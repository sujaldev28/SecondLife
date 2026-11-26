'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileCheck2,
  GitBranch,
  Layers,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface PreviewListing {
  listingId: string;
  title: string;
  summary: string;
  listingType: string;
  askingPriceMinor: number;
  currency: string;
  primaryLanguage: string | null;
  techStack: string[];
  technicalScore: number | null;
  verificationStatus: string;
  categoryName: string;
}

const FAQS = [
  [
    'Does repository inactivity mean an asset is abandoned or free to sell?',
    'No. Inactivity only surfaces a discovery candidate for review. Every marketplace listing requires explicit ownership attestation, contributor disclosures, and specialist verification.',
  ],
  [
    'Does SecondLife ever execute untrusted submitted code?',
    'Never. Uploaded ZIP archives are inspected safely against Zip Slip and zip bombs, and analyzed strictly via static AST, dependency, and secret-pattern scanning inside an isolated Python service.',
  ],
  [
    'How does SecondLife compute commercial revival estimates?',
    'Every commercial evaluation separates Technical, Reusability, and Commercial Opportunity scores, models engineering revival hours/costs using documented rate assumptions, and explicitly reports uncertainty factors.',
  ],
  [
    'How are transactions and commissions settled?',
    'Platform commissions are calculated server-side from configurable governance rules. SecondLife integrates with Razorpay via HMAC-verified orders and webhooks, or verified invoice reconciliation when split settlement is not active.',
  ],
];

export default function HomePage() {
  const [preview, setPreview] = useState<PreviewListing[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    apiFetch<{ listings: PreviewListing[] }>('/marketplace/listings?limit=3')
      .then((d) => setPreview(d.listings))
      .catch(() => { });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-app text-primary-token">
      <Navbar />

      <main className="flex-1">
        {/* 1. HERO SECTION */}
        <section className="relative overflow-hidden border-b border-token sl-grid-bg px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[#8B5CF6]/20 blur-[110px]" />
          <div className="pointer-events-none absolute -bottom-32 right-1/5 h-96 w-96 rounded-full bg-[#22D3EE]/15 blur-[110px]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3.5 py-1 text-xs font-semibold text-[#C4B5FD]">
                <Sparkles className="h-3.5 w-3.5 text-[#E879F9]" />
                Intelligent Digital Revival Platform
              </span>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[54px] lg:leading-[1.1]">
                <span className="sl-gradient-text">
                  Turn Forgotten Digital Assets Into New Opportunities.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-secondary-token sm:text-lg">
                Discover, evaluate, and commercialize underutilized software, projects, and digital
                intellectual property through one intelligent platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link
                  href="/explore"
                  className="sl-gradient-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-[0_0_28px_-4px_rgba(139,92,246,0.7)]"
                >
                  Explore Assets
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/owner/submit"
                  className="inline-flex items-center gap-2 rounded-xl border border-token bg-surface px-6 py-3 text-sm font-semibold text-primary-token transition hover:bg-surface-elevated"
                >
                  Submit an Asset
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-token pt-6">
                <div>
                  <div className="text-xs font-semibold text-[#22D3EE]">Static AST + AI</div>
                  <div className="mt-0.5 text-xs text-muted-token">Sandboxed code &amp; secret audit</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#34D399]">Rights Verified</div>
                  <div className="mt-0.5 text-xs text-muted-token">Ownership &amp; license gates</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#A78BFA]">Deal Execution</div>
                  <div className="mt-0.5 text-xs text-muted-token">Agreements &amp; audited handover</div>
                </div>
              </div>
            </div>

            {/* Custom Visual: Digital Revival Engine Diagram */}
            <div className="lg:col-span-5">
              <div className="sl-card relative overflow-hidden rounded-2xl p-6 shadow-[0_0_50px_-15px_rgba(99,102,241,0.4)]">
                <div className="flex items-center justify-between border-b border-token pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" />
                    <span className="font-mono text-xs font-semibold text-primary-token">
                      revival-pipeline.engine
                    </span>
                  </div>
                  <span className="rounded-full border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#22D3EE]">
                    VERIFIED FLOW
                  </span>
                </div>

                <div className="mt-5 space-y-3.5">
                  {[
                    {
                      step: '01 INGEST',
                      title: 'Dormant Repository / ZIP Archive',
                      meta: 'Zip Slip & SSRF validated • Zero code execution',
                      color: 'border-[#60A5FA]/35 bg-[#60A5FA]/10 text-[#60A5FA]',
                    },
                    {
                      step: '02 EVALUATE',
                      title: 'Technical & Revival Intelligence',
                      meta: 'AST quality • Secret redaction • Effort modeling',
                      color: 'border-[#22D3EE]/35 bg-[#22D3EE]/10 text-[#22D3EE]',
                    },
                    {
                      step: '03 VERIFY',
                      title: 'Ownership & License Compliance Gate',
                      meta: 'Contributor assignment • Copyleft risk check',
                      color: 'border-[#8B5CF6]/35 bg-[#8B5CF6]/10 text-[#A78BFA]',
                    },
                    {
                      step: '04 COMMERCIALIZE',
                      title: 'License, Transfer, or Revival Deal',
                      meta: 'Dual-signed agreement • Checksummed handover',
                      color: 'border-[#34D399]/35 bg-[#34D399]/10 text-[#34D399]',
                    },
                  ].map((node) => (
                    <div
                      key={node.step}
                      className="flex items-center justify-between gap-3 rounded-xl border border-token bg-elevated p-3.5"
                    >
                      <div>
                        <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${node.color}`}>
                          {node.step}
                        </span>
                        <div className="mt-1.5 text-sm font-semibold text-primary-token">{node.title}</div>
                        <div className="text-xs text-muted-token">{node.meta}</div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. HOW SECONDLIFE WORKS */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
              How SecondLife Works
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-primary-token sm:text-3xl">
              From Dormant Codebase to Commercial Handover
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              ['01', 'Intake & Discovery', 'Submit assets manually, upload safe ZIP snapshots, or scan authorized GitHub/GitLab/Bitbucket repos.', '#60A5FA'],
              ['02', 'AI Technical Audit', 'Isolated Python AST analysis inspects architecture, dependencies, security sinks, and documentation.', '#22D3EE'],
              ['03', 'Rights Verification', 'Ownership attestations, contributor IP assignments, and license compatibility undergo specialist review.', '#8B5CF6'],
              ['04', 'Deal & Handover', 'Match buyers, negotiate offers in deal rooms, execute agreements, settle, and confirm checksummed delivery.', '#34D399'],
            ].map(([num, title, desc, color]) => (
              <div key={num} className="sl-card rounded-2xl p-6">
                <div className="font-mono text-xs font-bold" style={{ color }}>
                  STEP {num}
                </div>
                <h3 className="mt-2.5 text-base font-semibold text-primary-token">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-token">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. THE DIGITAL ASSET OPPORTUNITY */}
        <section className="border-y border-token bg-elevated px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#E879F9]">
                  The Digital Asset Opportunity
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-primary-token sm:text-3xl">
                  Software Sustainability Meets IP Commercialization
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-secondary-token">
                  High-value billing engines, observability tools, vertical SaaS modules, and research
                  algorithms routinely go dormant when startups pivot or priorities shift. SecondLife
                  gives creators a compliant path to monetize and gives buyers a verified head start.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                {[
                  ['Reusable Source & SDKs', 'Production-tested backend services, authentication modules, and billing ledgers.', Cpu],
                  ['Algorithms & ML Pipelines', 'Domain-tuned forecasting, NLP extraction, and anomaly correlation workflows.', Sparkles],
                  ['Paused SaaS Products', 'Complete multi-tenant applications ready for acquisition or white-label revival.', Layers],
                  ['Research Prototypes', 'Documented academic & R&D implementations eligible for commercial licensing.', GitBranch],
                ].map(([t, d, Icon]) => {
                  const Ic = Icon as React.ComponentType<{ className?: string }>;
                  return (
                    <div key={String(t)} className="sl-card rounded-2xl p-5">
                      <Ic className="h-5 w-5 text-[#22D3EE]" />
                      <h3 className="mt-3 text-sm font-semibold text-primary-token">{String(t)}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-secondary-token">{String(d)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 4. TECHNICAL INTELLIGENCE & 5. COMMERCIALIZATION WORKFLOW */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="sl-card rounded-2xl p-7">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
                Technical Intelligence
              </span>
              <h3 className="mt-2 text-xl font-bold text-primary-token">
                Transparent Scoring Backed by Evidence
              </h3>
              <p className="mt-2 text-sm text-secondary-token">
                Separate deterministic scores for Technical Quality, Maintainability, Security, and
                Documentation—paired with explicit confidence bounds and known evaluation limitations.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Technical', '86', '#22D3EE'],
                  ['Security', '89', '#34D399'],
                  ['Maintainability', '82', '#8B5CF6'],
                  ['Confidence', '85%', '#60A5FA'],
                ].map(([l, v, c]) => (
                  <div key={l} className="rounded-xl border border-token bg-elevated p-3 text-center">
                    <div className="text-xl font-bold tabular-nums" style={{ color: c }}>
                      {v}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-token">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sl-card rounded-2xl p-7">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#34D399]">
                Commercialization Workflow
              </span>
              <h3 className="mt-2 text-xl font-bold text-primary-token">
                Flexible Deal Structures for Every Asset
              </h3>
              <p className="mt-2 text-sm text-secondary-token">
                Configure non-exclusive licenses, exclusive commercial rights, full IP transfers,
                or milestone-backed revival partnerships—with server-verified commissions.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  ['Non-Exclusive License', 'Monetize repeatedly across adopters'],
                  ['Exclusive License', 'Grant category exclusivity with terms'],
                  ['Full IP Transfer', 'Complete ownership & repo handover'],
                  ['Revival Partnership', 'Co-modernize dormant codebases'],
                ].map(([t, s]) => (
                  <div key={t} className="rounded-xl border border-token bg-elevated p-3">
                    <div className="text-xs font-semibold text-primary-token">{t}</div>
                    <div className="mt-0.5 text-[11px] text-muted-token">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 6. LIVE MARKETPLACE PREVIEW */}
        <section className="border-y border-token bg-elevated px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
                  Live Marketplace Preview
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-primary-token sm:text-3xl">
                  Verified Assets Ready for Adoption
                </h2>
              </div>
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#22D3EE] hover:underline"
              >
                View all marketplace assets <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {preview.length === 0 ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="sl-card h-64 animate-pulse rounded-2xl p-6" />
                ))
              ) : (
                preview.map((item) => (
                  <Link
                    key={item.listingId}
                    href={`/assets/${item.listingId}`}
                    className="sl-card group flex flex-col justify-between rounded-2xl p-6 transition hover:border-[#8B5CF6]/55"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#22D3EE]">{item.categoryName}</span>
                        <StatusBadge status={item.verificationStatus} />
                      </div>
                      <h3 className="mt-3 text-base font-bold text-primary-token group-hover:text-[#A78BFA]">
                        {item.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-secondary-token">
                        {item.summary}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {item.techStack.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-md border border-token bg-elevated px-2 py-0.5 text-[11px] font-medium text-secondary-token"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-token pt-4">
                      <div>
                        <div className="text-[11px] text-muted-token">{formatLabel(item.listingType)}</div>
                        <div className="text-base font-bold text-primary-token tabular-nums">
                          {formatMoney(item.askingPriceMinor, item.currency)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-token">Tech Score</div>
                        <div className="text-sm font-bold text-[#34D399]">
                          {item.technicalScore ?? '—'}/100
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 7. BENEFITS FOR OWNERS & 8. BENEFITS FOR BUYERS */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="sl-card rounded-2xl p-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">
                For Asset Owners
              </span>
              <h3 className="mt-2 text-2xl font-bold text-primary-token">
                Unlock Return on Dormant Engineering
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-secondary-token">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" />
                  Retain privacy: secrets are automatically redacted and confidential paths stay gated.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" />
                  Benchmark revival value with transparent commercial modeling before listing.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" />
                  Receive qualified offers, execute agreements, and track net payouts transparently.
                </li>
              </ul>
              <Link
                href="/for-owners"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#A78BFA] hover:underline"
              >
                Explore Owner Workflow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="sl-card rounded-2xl p-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
                For Buyers &amp; Engineering Teams
              </span>
              <h3 className="mt-2 text-2xl font-bold text-primary-token">
                Accelerate Shipping with Verified IP
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-secondary-token">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22D3EE]" />
                  Define tech stack, license, and budget criteria for explainable ranked matches.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22D3EE]" />
                  Compare candidate assets side by side on security, maintainability, and revival cost.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22D3EE]" />
                  Confirm SHA-256 verified handovers before completing deal settlement.
                </li>
              </ul>
              <Link
                href="/for-buyers"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#22D3EE] hover:underline"
              >
                Explore Buyer Workflow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* 9. ENTERPRISE OFFERING & 10. TRUST AND SECURITY */}
        <section className="border-y border-token bg-elevated px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <div className="sl-card rounded-2xl p-8">
              <div className="flex items-center gap-2.5 text-[#60A5FA]">
                <Building2 className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Enterprise Offering</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-primary-token">
                Multi-Tenant Workspaces &amp; Discovery Governance
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-token">
                Built for venture studios, R&amp;D labs, and corporate M&amp;A teams managing multi-seat
                portfolios with granular RBAC across 11 roles, organization audit trails, and configurable
                candidate discovery scans.
              </p>
              <Link
                href="/enterprise"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#60A5FA] hover:underline"
              >
                Explore Enterprise Capabilities <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="sl-card rounded-2xl p-8">
              <div className="flex items-center gap-2.5 text-[#34D399]">
                <LockKeyhole className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Trust &amp; Security</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-primary-token">
                Security &amp; IP Compliance at Every Boundary
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-secondary-token">
                {[
                  [ShieldCheck, 'Strict tenant & org isolation'],
                  [FileCheck2, 'Mandatory rights verification'],
                  [Scale, 'Copyleft & dispute auto-hold'],
                  [TrendingUp, 'Server-side commission & HMAC'],
                ].map(([Icon, txt]) => {
                  const Ic = Icon as React.ComponentType<{ className?: string }>;
                  return (
                    <div key={String(txt)} className="flex items-center gap-2 rounded-xl border border-token bg-elevated p-3">
                      <Ic className="h-4 w-4 shrink-0 text-[#34D399]" />
                      <span>{String(txt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 11. FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">FAQ</span>
            <h2 className="mt-2 text-2xl font-bold text-primary-token sm:text-3xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-8 space-y-3">
            {FAQS.map(([q, a], idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={q} className="sl-card overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-sm font-semibold text-primary-token cursor-pointer"
                  >
                    <span>{q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-token transition-transform ${isOpen ? 'rotate-180 text-[#8B5CF6]' : ''
                        }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-token px-6 py-4 text-sm leading-relaxed text-secondary-token">
                      {a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 12. FINAL CTA */}
        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-[#8B5CF6]/35 bg-gradient-to-br from-[#141A2B] via-[#1A2236] to-[#0E1220] p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-[#8B5CF6]/25 blur-3xl" />
            <h2 className="relative text-2xl font-bold text-white sm:text-3xl">
              Ready to Give Dormant Software a Second Life?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm text-slate-300">
              Create your workspace to evaluate an existing asset or explore verified codebases ready
              for commercial deployment.
            </p>
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="sl-gradient-primary rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Create Free Account
              </Link>
              <Link
                href="/explore"
                className="rounded-xl border border-slate-600 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 13. FOOTER */}
      <Footer />
    </div>
  );
}
