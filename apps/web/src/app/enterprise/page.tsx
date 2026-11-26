import Link from 'next/link';
import { PublicPageLayout } from '@/components/PublicPageLayout';

export default function EnterprisePage() {
  return (
    <PublicPageLayout
      eyebrow="Enterprise & Institutional Sourcing"
      title="Multi-Tenant Asset Governance & Discovery at Scale"
      subtitle="Built for R&D labs, venture studios, corporate M&A teams, and enterprise software portfolios."
    >
      <div className="sl-card space-y-4 rounded-2xl p-8 text-sm leading-relaxed text-secondary-token">
        <p>
          <strong className="text-primary-token">Dedicated Organization Workspaces:</strong> Segregate internal IP portfolios,
          acquisition targets, and team permissions across workspaces with full audit trails.
        </p>
        <p>
          <strong className="text-primary-token">Configurable Discovery Pipelines:</strong> Scan authorized GitHub, GitLab,
          and Bitbucket sources for dormant candidate projects—strictly flagged as candidates requiring ownership verification.
        </p>
        <p>
          <strong className="text-primary-token">Dedicated Compliance &amp; Verification SLAs:</strong> Accelerated specialist
          review for complex multi-contributor or dual-licensed codebases.
        </p>
        <div className="pt-2">
          <Link href="/contact" className="sl-gradient-primary inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
            Request Enterprise Briefing
          </Link>
        </div>
      </div>
    </PublicPageLayout>
  );
}
