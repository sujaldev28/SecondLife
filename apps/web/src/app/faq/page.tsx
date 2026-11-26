import { PublicPageLayout } from '@/components/PublicPageLayout';

const FAQS = [
  ['Does repository inactivity mean an asset is abandoned or free to sell?', 'No. Inactivity only flags a discovery candidate. No asset can be listed without explicit ownership attestation, license review, and specialist verification.'],
  ['Does SecondLife execute untrusted submitted code on its application servers?', 'Never. Archive uploads are validated against Zip Slip and zip bombs and analyzed purely statically in an isolated Python analysis service.'],
  ['How are commercial valuations calculated?', 'Every commercial report uses documented engineering revival cost assumptions, complexity metrics, and explicit confidence/uncertainty disclosures—never opaque arbitrary numbers.'],
  ['How do payments and commissions work in India?', 'SecondLife integrates with Razorpay via a provider-agnostic payment interface with HMAC webhook verification and server-side commission computation, plus compliant invoice settlement tracking when marketplace split settlements are not enabled.'],
];

export default function FaqPage() {
  return (
    <PublicPageLayout
      eyebrow="FAQ"
      title="Frequently Asked Questions"
      subtitle="Key operational, security, and legal compliance questions answered."
    >
      <div className="space-y-4">
        {FAQS.map(([q, a]) => (
          <div key={q} className="sl-card rounded-2xl p-6">
            <h2 className="text-base font-semibold text-primary-token">{q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-token">{a}</p>
          </div>
        ))}
      </div>
    </PublicPageLayout>
  );
}
