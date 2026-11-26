'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatMoney } from '@/lib/api';

interface Recommendation {
  requirementTitle: string;
  listingId: string;
  title: string;
  askingPriceMinor: number;
  currency: string;
  technicalScore: number;
  matchScore: number;
  explanation: { reasons: string[]; gaps: string[] };
}

export default function BuyerRecommendationsPage() {
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    apiFetch<{ recommendations: Recommendation[] }>('/buyer/recommendations')
      .then((d) => setRecs(d.recommendations))
      .catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="buyer"
      title="Explainable Asset Recommendations"
      subtitle="Ranked asset compatibility scores with transparent match reasons and requirement gaps."
    >
      {recs.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No recommendations computed yet"
          description="Create a Buyer Requirement first to compute explainable asset compatibility matches."
          action={
            <Link href="/dashboard/buyer/requirements" className="sl-gradient-primary rounded-xl px-4 py-2 text-xs font-semibold text-white">
              Define Requirement
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {recs.map((r, i) => (
            <SurfaceCard key={`${r.listingId}-${i}`} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[#A78BFA]">For: {r.requirementTitle}</span>
                  <h3 className="mt-1 text-lg font-bold text-primary-token">{r.title}</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#34D399] tabular-nums">{r.matchScore}% Match</div>
                    <div className="text-xs text-secondary-token">
                      {formatMoney(r.askingPriceMinor, r.currency)} • Tech {r.technicalScore}/100
                    </div>
                  </div>
                  <Link href={`/assets/${r.listingId}`} className="sl-gradient-primary rounded-xl px-4 py-2 text-xs font-semibold text-white">
                    View Asset
                  </Link>
                </div>
              </div>
              <div className="mt-4 grid gap-4 border-t border-token pt-3 text-xs sm:grid-cols-2">
                <div className="space-y-1.5 text-[#34D399]">
                  {r.explanation.reasons.map((x) => (
                    <div key={x} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{x}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 text-[#FBBF24]">
                  {r.explanation.gaps.map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
