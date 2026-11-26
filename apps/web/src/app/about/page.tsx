import { PublicPageLayout } from '@/components/PublicPageLayout';

export default function AboutPage() {
  return (
    <PublicPageLayout
      eyebrow="About SecondLife"
      title="Turning Dormant Engineering into Reusable Economic Value"
      subtitle="SecondLife builds the technical, legal-verification, and commercial transaction infrastructure to help software creators and enterprises revive underutilized digital assets."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="sl-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-primary-token">Why SecondLife Exists</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary-token">
            Millions of engineering hours sit idle inside paused startups, sunset internal tools,
            research prototypes, and archived repositories. Meanwhile, teams rebuild identical
            foundational systems from scratch. SecondLife bridges this gap responsibly.
          </p>
        </div>
        <div className="sl-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-primary-token">Compliance-First Principles</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary-token">
            Inactivity never implies ownership waiver or permission to commercialize. Every asset on
            SecondLife undergoes explicit ownership declarations, contributor disclosures, license
            screening, and specialist verification before any marketplace listing goes live.
          </p>
        </div>
      </div>
    </PublicPageLayout>
  );
}
