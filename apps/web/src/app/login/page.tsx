'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { API_BASE, apiFetch, setStoredTokens } from '@/lib/api';

interface DemoAccount {
  fullName: string;
  email: string;
  password: string;
  role: string;
  roleLabel: string;
  description: string;
}

interface AuthConfig {
  demoModeEnabled: boolean;
  googleOAuthEnabled: boolean;
  demoAccounts: DemoAccount[];
}

const OAUTH_ERRORS: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled. You can try again or sign in with email and password.',
  google_not_configured: 'Google OAuth credentials are not configured on this server yet.',
  invalid_callback: 'Invalid OAuth callback parameters received from Google.',
  failed: 'Google authentication could not be verified. Please try again.',
};

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    const oauthErr = searchParams.get('oauth_error');
    if (oauthErr) {
      setError(OAUTH_ERRORS[oauthErr] || 'Authentication error occurred.');
    }
  }, [searchParams]);

  useEffect(() => {
    apiFetch<AuthConfig>('/auth/config')
      .then(setAuthConfig)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: { primaryRole: string; fullName: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredTokens(res.accessToken, res.refreshToken);
      await refreshUser();
      pushToast(`Welcome back, ${res.user.fullName}`, 'success');

      if (
        res.user.primaryRole === 'super_admin' ||
        res.user.primaryRole === 'platform_admin' ||
        res.user.primaryRole === 'verification_specialist'
      ) {
        router.push('/dashboard/admin');
      } else if (res.user.primaryRole === 'buyer') {
        router.push('/dashboard/buyer');
      } else {
        router.push('/dashboard/owner');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/auth/google/start?redirectTo=/dashboard/owner`;
  };

  return (
    <div className="sl-card relative w-full max-w-md rounded-2xl p-8 animate-sl-in">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
        <LockKeyhole className="h-3.5 w-3.5" />
        Secure Workspace Access
      </div>
      <h1 className="mt-2 text-2xl font-bold text-primary-token">Sign in to SecondLife</h1>
      <p className="mt-1 text-sm text-secondary-token">
        Access your asset portfolio, deal rooms, or governance console.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-secondary-token">Work Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-secondary-token">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-[#22D3EE] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              required
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sl-input w-full rounded-xl py-2.5 pr-10 pl-3.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label="Toggle password visibility"
              className="absolute top-2.5 right-3 text-muted-token hover:text-primary-token cursor-pointer"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs font-medium text-[#FB7185]">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full py-2.5">
          Sign In
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogleSignIn}
          className="w-full py-2.5"
        >
          Continue with Google
        </Button>
      </form>

      {authConfig?.demoModeEnabled && authConfig.demoAccounts.length > 0 && (
        <div className="mt-6 rounded-xl border border-token bg-elevated p-3.5 text-xs">
          <div className="font-semibold text-primary-token">
            Demo Credentials (Not Real Customer Accounts)
          </div>
          <p className="mt-0.5 text-[11px] text-muted-token">
            Select an account below to autofill, then click Sign In.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {authConfig.demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc)}
                className="w-full rounded-lg border border-token bg-surface px-3 py-2 text-left font-medium text-secondary-token transition hover:border-[#8B5CF6]/50 hover:text-primary-token cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-primary-token">{acc.fullName}</span>
                  <span className="text-[10px] font-semibold text-[#22D3EE]">{acc.roleLabel}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-token">
                  <span>{acc.email}</span>
                  <span>{acc.password}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-xs text-secondary-token">
        New to SecondLife?{' '}
        <Link href="/register" className="font-semibold text-[#A78BFA] hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-[#8B5CF6]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-80 w-80 rounded-full bg-[#22D3EE]/12 blur-3xl" />
        <Suspense fallback={<div className="text-sm text-secondary-token">Loading...</div>}>
          <LoginInner />
        </Suspense>
      </main>
    </div>
  );
}
