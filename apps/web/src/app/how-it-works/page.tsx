import { PublicPageLayout } from '@/components/PublicPageLayout';

const STEPS = [
  ['01', 'Intake & Sandboxed Ingestion', 'Submit via authorized GitHub/GitLab/Bitbucket URLs or upload validated ZIP archives protected against Zip Slip, zip bombs, and SSRF.', '#60A5FA'],
  ['02', 'Technical & Commercial Intelligence', 'Isolated static analysis inspects AST structure, dependencies, exposed secrets, maintainability, and models revival effort with explicit confidence bounds.', '#22D3EE'],
  ['03', 'Ownership & License Verification', 'Submit legal ownership attestations, contributor assignments, and license disclosures. Verification Specialists approve or flag IP conflicts.', '#8B5CF6'],
  ['04', 'Marketplace & Buyer Matching', 'Verified assets publish under clear licensing, full transfer, or revival partnership terms, matched against structured buyer requirements.', '#A78BFA'],
  ['05', 'Deal Room, Settlement & Handover', 'Negotiate offers, execute dual-signed agreements, settle via Razorpay or verified invoice reconciliation, and confirm checksummed asset delivery.', '#34D399'],
];

export default function HowItWorksPage() {
  return (
    <PublicPageLayout
      eyebrow="Platform Workflow"
      title="How SecondLife Works"
      subtitle="A controlled lifecycle from dormant codebase intake to verified commercial handover."
    >
      <div className="space-y-4">
        {STEPS.map(([num, title, desc, color]) => (
          <div key={title} className="sl-card flex gap-4 rounded-2xl p-6">
            <div className="font-mono text-sm font-bold" style={{ color }}>{num}</div>
            <div>
              <h2 className="text-base font-semibold text-primary-token">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary-token">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PublicPageLayout>
  );
}
