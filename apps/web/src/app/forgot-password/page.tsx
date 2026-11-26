'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState('');
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string; devResetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResult(res.message);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="sl-card w-full max-w-md rounded-2xl p-8 animate-sl-in">
          <h1 className="text-xl font-bold text-primary-token">Reset Password</h1>
          <p className="mt-1 text-sm text-secondary-token">
            Enter your account email to receive a single-use password recovery token.
          </p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="sl-input w-full rounded-xl px-3.5 py-2.5 text-sm"
            />
            <Button type="submit" loading={loading} className="w-full py-2.5">
              Send Reset Instructions
            </Button>
          </form>
          {result && (
            <p className="mt-4 rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/10 p-3 text-xs text-[#22D3EE]">
              {result}
            </p>
          )}
          {devToken && (
            <div className="mt-3 text-xs">
              <Link
                href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                className="font-semibold text-[#A78BFA] underline"
              >
                Continue to Reset Password →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
