'use client';

import { useState } from 'react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { Button } from '@/components/ui/Primitives';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('enterprise');
  const [message, setMessage] = useState('');

  return (
    <PublicPageLayout
      eyebrow="Contact"
      title="Reach the SecondLife Team"
      subtitle="Enterprise discovery inquiries, IP compliance questions, or partnership requests."
    >
      <div className="sl-card mx-auto max-w-xl rounded-2xl p-8">
        {sent ? (
          <div className="rounded-xl border border-[#34D399]/35 bg-[#34D399]/12 p-4 text-sm text-[#34D399]">
            Thank you, {name}. Your inquiry regarding <strong>{topic}</strong> has been recorded for our operations desk at{' '}
            <code>{email}</code>.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-secondary-token">Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Work Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Topic</label>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="enterprise">Enterprise Discovery</option>
                <option value="verification">IP &amp; Verification Support</option>
                <option value="partnership">Revival Partner Network</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Message</label>
              <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <Button type="submit" className="w-full py-2.5">
              Submit Inquiry
            </Button>
          </form>
        )}
      </div>
    </PublicPageLayout>
  );
}
