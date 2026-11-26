import { PublicPageLayout } from '@/components/PublicPageLayout';

export default function PrivacyPage() {
  return (
    <PublicPageLayout
      eyebrow="Privacy & Data Protection"
      title="Privacy Policy"
      subtitle="How SecondLife handles account identities, private repositories, and audit logs."
    >
      <div className="sl-card space-y-4 rounded-2xl p-8 text-sm leading-relaxed text-secondary-token">
        <p><strong className="text-primary-token">1. Tenant Isolation:</strong> Draft assets, uploaded source archives, and confidential risk findings are strictly isolated to authorized organization members and designated reviewers.</p>
        <p><strong className="text-primary-token">2. Secret Redaction:</strong> Automated secret scanning redacts detected credentials from reports and logs.</p>
        <p><strong className="text-primary-token">3. Audit Retention:</strong> Security, verification, agreement signature, and transaction events are preserved for compliance traceability.</p>
      </div>
    </PublicPageLayout>
  );
}
