import Link from 'next/link';
import { PublicPageLayout } from '@/components/PublicPageLayout';

export default function ForBuyersPage() {
  return (
    <PublicPageLayout
      eyebrow="For Buyers & Technology Teams"
      title="Source Verified Codebases & IP with Transparent Risk Reports"
      subtitle="Accelerate product delivery with pre-evaluated architecture, license clarity, and realistic revival estimates."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {[
          ['Explainable Requirement Matching', 'Define your target tech stack, license constraints, minimum technical score, and budget for ranked recommendations.', '#22D3EE'],
          ['Technical & Security Due Diligence', 'Inspect maintainability, test indicators, dependency health, and flagged security risks before negotiating.', '#8B5CF6'],
          ['Protected Commercial Execution', 'Submit inquiries, counter offers, execute agreements, and verify delivery checksums inside one deal room.', '#34D399'],
        ].map(([t, d, c]) => (
          <div key={t} className="sl-card rounded-2xl p-6">
            <div className="h-1 w-10 rounded-full" style={{ backgroundColor: c }} />
            <h2 className="mt-4 text-base font-semibold text-primary-token">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-token">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link href="/explore" className="sl-gradient-primary inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
          Browse Verified Assets
        </Link>
      </div>
    </PublicPageLayout>
  );
}
