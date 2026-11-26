import { PublicPageLayout } from '@/components/PublicPageLayout';

export default function TermsPage() {
  return (
    <PublicPageLayout
      eyebrow="Legal Governance"
      title="Terms and Conditions"
      subtitle="Platform rules governing asset submission, ownership representations, and commercialization."
    >
      <div className="sl-card space-y-4 rounded-2xl p-8 text-sm leading-relaxed text-secondary-token">
        <p><strong className="text-primary-token">1. Ownership Representations:</strong> Submitting parties warrant they hold full legal title or documented authority to license or transfer submitted digital assets.</p>
        <p><strong className="text-primary-token">2. Open-Source &amp; Third-Party Rights:</strong> Copyleft and third-party dependencies must be accurately disclosed; SecondLife verification does not constitute formal legal counsel.</p>
        <p><strong className="text-primary-token">3. Dispute &amp; Takedown Policy:</strong> Active ownership or copyright disputes trigger immediate marketplace suspension pending compliance review.</p>
        <p><strong className="text-primary-token">4. Evaluation Disclaimers:</strong> Technical and commercial scores are analytical estimates accompanied by stated assumptions and limitations.</p>
      </div>
    </PublicPageLayout>
  );
}
