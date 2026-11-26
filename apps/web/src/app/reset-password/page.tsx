'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

function ResetPasswordInner() {
  const sp = useSearchParams();
  const [token, setToken] = useState(sp.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setMsg('Password updated and all previous sessions revoked.');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sl-card w-full max-w-md rounded-2xl p-8 animate-sl-in">
      <h1 className="text-xl font-bold text-primary-token">Choose a New Password</h1>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <input
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Reset token"
          className="sl-input w-full rounded-xl px-3.5 py-2.5 font-mono text-xs"
        />
        <input
          required
          type="password"
          minLength={10}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 10 chars)"
          className="sl-input w-full rounded-xl px-3.5 py-2.5 text-sm"
        />
        <Button type="submit" loading={loading} className="w-full py-2.5">
          Update Password
        </Button>
      </form>
      {msg && (
        <p className="mt-4 rounded-xl border border-[#34D399]/35 bg-[#34D399]/12 p-3 text-xs text-[#34D399]">
          {msg}
        </p>
      )}
      {err && (
        <p className="mt-4 rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs text-[#FB7185]">
          {err}
        </p>
      )}
      <div className="mt-4 text-center">
        <Link href="/login" className="text-xs font-semibold text-[#22D3EE] hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-sm text-secondary-token">Loading...</div>}>
          <ResetPasswordInner />
        </Suspense>
      </main>
    </div>
  );
}
