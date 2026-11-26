'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowUpRight, GitCompare, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, SkeletonCard, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel, formatMoney } from '@/lib/api';

interface MarketplaceListing {
  listingId: string;
  title: string;
  summary: string;
  listingType: string;
  currency: string;
  askingPriceMinor: number;
  assetId: string;
  assetCode: string;
  primaryLanguage: string | null;
  techStack: string[];
  declaredLicense: string;
  verificationStatus: string;
  isDemoSeed: boolean;
  categorySlug: string;
  categoryName: string;
  organizationName: string;
  technicalScore: number | null;
  commercialScore: number | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

function ExploreInner() {
  const sp = useSearchParams();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(sp.get('q') || '');
  const [category, setCategory] = useState('');
  const [listingType, setListingType] = useState('');
  const [minTechScore, setMinTechScore] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'score' | 'price_asc'>('newest');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Array<Record<string, unknown>> | null>(null);

  const loadListings = async (overrideCat?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const activeCat = overrideCat !== undefined ? overrideCat : category;
      if (activeCat) params.set('category', activeCat);
      if (listingType) params.set('listingType', listingType);
      if (minTechScore) params.set('minTechScore', minTechScore);

      const data = await apiFetch<{ listings: MarketplaceListing[] }>(
        `/marketplace/listings?${params.toString()}`,
      );
      setListings(data.listings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {});
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedListings = [...listings].sort((a, b) => {
    if (sortBy === 'score') return (b.technicalScore ?? 0) - (a.technicalScore ?? 0);
    if (sortBy === 'price_asc') return a.askingPriceMinor - b.askingPriceMinor;
    return 0;
  });

  const featured = sortedListings[0];

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  };

  const runCompare = async () => {
    if (compareIds.length < 2) return;
    const data = await apiFetch<{ comparison: Array<Record<string, unknown>> }>(
      `/marketplace/compare?ids=${compareIds.join(',')}`,
    );
    setComparison(data.comparison);
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 animate-sl-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
            Verified Digital Asset Exchange
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-token">
            Explore Marketplace Assets
          </h1>
          <p className="mt-1 text-sm text-secondary-token">
            Every published asset has cleared ownership attestation, license review, and static evaluation.
          </p>
        </div>

        {compareIds.length >= 2 && (
          <Button type="button" onClick={runCompare}>
            <GitCompare className="h-4 w-4" />
            Compare Selected ({compareIds.length})
          </Button>
        )}
      </div>

      {/* Category Pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setCategory('');
            loadListings('');
          }}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            category === ''
              ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#C4B5FD]'
              : 'border-token bg-surface text-secondary-token hover:text-primary-token'
          }`}
        >
          All Categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategory(c.slug);
              loadListings(c.slug);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              category === c.slug
                ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]'
                : 'border-token bg-surface text-secondary-token hover:text-primary-token'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <SurfaceCard className="mt-4 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadListings();
          }}
          className="grid gap-3 md:grid-cols-6"
        >
          <div className="relative md:col-span-2">
            <Search className="absolute top-3 left-3 h-4 w-4 text-muted-token" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stack, title, domain..."
              className="sl-input w-full rounded-xl py-2.5 pr-3 pl-9 text-sm"
            />
          </div>

          <select
            value={listingType}
            onChange={(e) => setListingType(e.target.value)}
            className="sl-input rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">All Deal Types</option>
            <option value="non_exclusive_license">Non-Exclusive License</option>
            <option value="exclusive_license">Exclusive License</option>
            <option value="full_transfer">Full Transfer</option>
            <option value="revival_partnership">Revival Partnership</option>
          </select>

          <input
            type="number"
            min={0}
            max={100}
            value={minTechScore}
            onChange={(e) => setMinTechScore(e.target.value)}
            placeholder="Min Tech Score"
            className="sl-input rounded-xl px-3 py-2.5 text-sm"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'score' | 'price_asc')}
            className="sl-input rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="newest">Sort: Latest</option>
            <option value="score">Sort: Highest Tech Score</option>
            <option value="price_asc">Sort: Price Low → High</option>
          </select>

          <Button type="submit">
            <SlidersHorizontal className="h-4 w-4" />
            Apply
          </Button>
        </form>
      </SurfaceCard>

      {/* Featured Highlight */}
      {!loading && featured && !q && !category && (
        <SurfaceCard className="mt-6 overflow-hidden border-[#8B5CF6]/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E879F9]">
                <Sparkles className="h-3.5 w-3.5" />
                Featured Verified Asset • {featured.categoryName}
              </div>
              <Link
                href={`/assets/${featured.listingId}`}
                className="mt-2 block text-xl font-bold text-primary-token hover:text-[#A78BFA]"
              >
                {featured.title}
              </Link>
              <p className="mt-2 text-sm text-secondary-token">{featured.summary}</p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-muted-token">Tech Score</div>
                <div className="text-2xl font-bold text-[#34D399]">{featured.technicalScore ?? '—'}/100</div>
              </div>
              <div>
                <div className="text-xs text-muted-token">{formatLabel(featured.listingType)}</div>
                <div className="text-2xl font-bold text-primary-token">
                  {formatMoney(featured.askingPriceMinor, featured.currency)}
                </div>
              </div>
              <Link
                href={`/assets/${featured.listingId}`}
                className="sl-gradient-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white"
              >
                Inspect Asset <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Comparison Matrix */}
      {comparison && (
        <SurfaceCard className="mt-6 border-[#22D3EE]/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-primary-token">Side-by-Side Comparison Matrix</h2>
            <button
              type="button"
              onClick={() => setComparison(null)}
              className="text-xs font-semibold text-muted-token hover:text-primary-token cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-token text-xs text-muted-token">
                  <th className="py-2.5 pr-4">Asset</th>
                  <th className="py-2.5 pr-4">Arrangement</th>
                  <th className="py-2.5 pr-4">Price</th>
                  <th className="py-2.5 pr-4">Tech Score</th>
                  <th className="py-2.5 pr-4">Security</th>
                  <th className="py-2.5 pr-4">Revival Effort</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={String(c.listingId)} className="border-b border-token/50">
                    <td className="py-3 pr-4 font-semibold text-primary-token">{String(c.title)}</td>
                    <td className="py-3 pr-4 text-secondary-token">{formatLabel(String(c.listingType))}</td>
                    <td className="py-3 pr-4 font-semibold text-primary-token">
                      {formatMoney(Number(c.askingPriceMinor), String(c.currency))}
                    </td>
                    <td className="py-3 pr-4 font-bold text-[#22D3EE]">{String(c.technicalScore ?? '—')}/100</td>
                    <td className="py-3 pr-4 font-bold text-[#34D399]">{String(c.securityScore ?? '—')}/100</td>
                    <td className="py-3 pr-4 text-secondary-token">
                      {c.estimatedRevivalHoursMin ? `${c.estimatedRevivalHoursMin}–${c.estimatedRevivalHoursMax}h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      {/* Listings Grid */}
      {loading ? (
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-72" />
          ))}
        </div>
      ) : sortedListings.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matching verified assets found"
            description="Adjust your search query, category, or technical score threshold."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedListings.map((item) => (
            <SurfaceCard
              key={item.listingId}
              className="flex flex-col justify-between p-6 hover:border-[#6366F1]/60"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#22D3EE]">{item.categoryName}</span>
                  <div className="flex items-center gap-1.5">
                    {item.isDemoSeed && (
                      <span className="rounded-md border border-token bg-elevated px-2 py-0.5 text-[10px] font-medium text-muted-token">
                        Demo Seed
                      </span>
                    )}
                    <StatusBadge status={item.verificationStatus} />
                  </div>
                </div>

                <Link
                  href={`/assets/${item.listingId}`}
                  className="mt-3 block text-lg font-bold text-primary-token transition hover:text-[#A78BFA]"
                >
                  {item.title}
                </Link>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-secondary-token">
                  {item.summary}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.techStack.slice(0, 4).map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md border border-token bg-elevated px-2 py-0.5 text-[11px] font-medium text-secondary-token"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-token pt-4">
                <div className="flex items-center justify-between text-xs text-muted-token">
                  <span>{formatLabel(item.listingType)}</span>
                  <span>
                    Tech: <strong className="text-[#34D399]">{item.technicalScore ?? '—'}/100</strong>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="text-lg font-bold text-primary-token tabular-nums">
                    {formatMoney(item.askingPriceMinor, item.currency)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompare(item.listingId)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        compareIds.includes(item.listingId)
                          ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]'
                          : 'border-token bg-elevated text-secondary-token hover:text-primary-token'
                      }`}
                    >
                      {compareIds.includes(item.listingId) ? 'Selected' : 'Compare'}
                    </button>
                    <Link
                      href={`/assets/${item.listingId}`}
                      className="sl-gradient-primary inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Inspect <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </main>
  );
}

export default function ExplorePage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <Suspense fallback={<div className="flex-1 p-12 text-center text-sm text-secondary-token">Loading marketplace...</div>}>
        <ExploreInner />
      </Suspense>
      <Footer />
    </div>
  );
}
