'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  const [token, setToken] = useState(initialToken);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async (t: string) => {
    setLoading(true);
    try {
      await apiFetch('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: t }),
      });
      setStatus('success');
      setMessage('Email verified successfully. Full workspace permissions are now active.');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) verify(initialToken);
  }, [initialToken]);

  return (
    <div className="sl-card w-full max-w-md rounded-2xl p-8 animate-sl-in">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#34D399]">
        <MailCheck className="h-4 w-4" />
        Identity Verification
      </div>
      <h1 className="mt-2 text-xl font-bold text-primary-token">Verify Your Email</h1>
      <p className="mt-1 text-sm text-secondary-token">
        Enter the verification token sent to your inbox to activate account actions.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify(token);
        }}
        className="mt-5 space-y-4"
      >
        <input
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Verification token"
          className="sl-input w-full rounded-xl px-3.5 py-2.5 font-mono text-xs"
        />
        <Button type="submit" loading={loading} className="w-full py-2.5">
          Confirm Verification
        </Button>
      </form>

      {status !== 'idle' && (
        <div
          className={`mt-4 rounded-xl border p-3 text-xs font-medium ${
            status === 'success'
              ? 'border-[#34D399]/35 bg-[#34D399]/12 text-[#34D399]'
              : 'border-[#FB7185]/35 bg-[#FB7185]/12 text-[#FB7185]'
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-5 text-center">
        <Link href="/dashboard/owner" className="text-xs font-semibold text-[#22D3EE] hover:underline">
          Continue to Console →
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-sm text-secondary-token">Loading...</div>}>
          <VerifyEmailInner />
        </Suspense>
      </main>
    </div>
  );
}
