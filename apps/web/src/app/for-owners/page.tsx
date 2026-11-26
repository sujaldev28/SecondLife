import Link from 'next/link';
import { PublicPageLayout } from '@/components/PublicPageLayout';

export default function ForOwnersPage() {
  return (
    <PublicPageLayout
      eyebrow="For Asset Owners"
      title="Monetize Dormant Software Without Exposing Secrets"
      subtitle="License non-exclusively, grant exclusive rights, transfer full IP, or partner with revival engineers."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {[
          ['Non-Exclusive & Exclusive Licensing', 'Retain underlying IP while licensing battle-tested modules to verified commercial adopters.', '#8B5CF6'],
          ['Full Asset Transfer', 'Exit paused products or internal tools cleanly with dual-signed transfer agreements and audited handovers.', '#22D3EE'],
          ['Revival Partnerships', 'Pair dormant repositories with engineering teams to modernize dependencies and share commercial upside.', '#34D399'],
        ].map(([t, d, c]) => (
          <div key={t} className="sl-card rounded-2xl p-6">
            <div className="h-1 w-10 rounded-full" style={{ backgroundColor: c }} />
            <h2 className="mt-4 text-base font-semibold text-primary-token">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-token">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link href="/dashboard/owner/submit" className="sl-gradient-primary inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
          Submit Your First Asset
        </Link>
      </div>
    </PublicPageLayout>
  );
}
