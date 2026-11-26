'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { apiFetch, formatMoney } from '@/lib/api';

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPriceMinor: number;
  currency: string;
  maxAssets: number;
  maxTeamSeats: number;
  features: string[];
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    apiFetch<{ plans: Plan[] }>('/subscriptions/plans')
      .then((d) => setPlans(d.plans))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6 lg:px-8 animate-sl-in">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
            Configurable Pricing
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary-token sm:text-4xl">
            Transparent Subscriptions &amp; Transaction Fees
          </h1>
          <p className="mt-3 text-sm text-secondary-token sm:text-base">
            Pricing plans and commission tiers are configurable by governance policy. Start free or
            scale enterprise IP discovery.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const featured = p.code === 'pro_growth';
            return (
              <div
                key={p.id}
                className={`sl-card flex flex-col justify-between rounded-2xl p-8 ${
                  featured ? 'border-[#8B5CF6] shadow-[0_0_40px_-14px_rgba(139,92,246,0.45)]' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-primary-token">{p.name}</h2>
                    {featured && (
                      <span className="rounded-full bg-[#8B5CF6]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#C4B5FD]">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-secondary-token">{p.description}</p>
                  <div className="mt-6 text-3xl font-bold text-primary-token tabular-nums">
                    {p.monthlyPriceMinor === 0
                      ? 'Free'
                      : `${formatMoney(p.monthlyPriceMinor, p.currency)}`}
                    {p.monthlyPriceMinor > 0 && (
                      <span className="text-sm font-normal text-muted-token"> / month</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-token">
                    Up to {p.maxAssets} assets • {p.maxTeamSeats} workspace seats
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-secondary-token">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#34D399]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href="/register"
                  className={`mt-8 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white transition ${
                    featured
                      ? 'sl-gradient-primary'
                      : 'border border-token bg-surface-elevated text-primary-token hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  Select {p.name}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="sl-card mt-12 rounded-2xl p-6 text-sm text-secondary-token">
          <strong className="text-primary-token">Marketplace Transaction Commissions:</strong>{' '}
          Baseline configurable commissions apply upon successful deal completion (10% standard on
          commercial licensing, 8% on full IP transfers). Paid deep third-party evaluation reports
          are priced per request.
        </div>
      </main>
      <Footer />
    </div>
  );
}
