'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { API_BASE, apiFetch, setStoredTokens } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { pushToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [accountType, setAccountType] = useState<'individual' | 'organization'>('individual');
  const [role, setRole] = useState<'individual_owner' | 'buyer' | 'developer' | 'org_owner'>('individual_owner');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const reg = await apiFetch<{ devVerificationToken?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          confirmPassword,
          accountType,
          role: accountType === 'organization' ? 'org_owner' : role,
          ...(accountType === 'organization' ? { organizationName } : {}),
        }),
      });

      const loginRes = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredTokens(loginRes.accessToken, loginRes.refreshToken);
      await refreshUser();
      pushToast('Workspace created successfully!', 'success');

      if (reg.devVerificationToken) {
        router.push(`/verify-email?token=${encodeURIComponent(reg.devVerificationToken)}`);
      } else {
        router.push(accountType === 'organization' ? '/onboarding' : '/dashboard/owner');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    window.location.href = `${API_BASE}/auth/google/start?redirectTo=/dashboard/owner`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute -top-24 right-1/3 h-80 w-80 rounded-full bg-[#8B5CF6]/15 blur-3xl" />

        <div className="sl-card relative w-full max-w-md rounded-2xl p-8 animate-sl-in">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">
            <Sparkles className="h-3.5 w-3.5" />
            Join SecondLife
          </div>
          <h1 className="mt-2 text-2xl font-bold text-primary-token">Create Your Account</h1>
          <p className="mt-1 text-sm text-secondary-token">
            Submit dormant digital assets or source verified IP.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary-token">Full Name</label>
              <input
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Work Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">
                Password (min 10 chars, upper, lower, number, special char)
              </label>
              <div className="relative mt-1.5">
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  minLength={10}
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

            <div>
              <label className="block text-xs font-medium text-secondary-token">Confirm Password</label>
              <input
                required
                type={showPw ? 'text' : 'password'}
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-secondary-token">Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as 'individual' | 'organization')}
                  className="sl-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="individual">Individual</option>
                  <option value="organization">Organization</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-token">Primary Focus</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as 'individual_owner' | 'buyer' | 'developer' | 'org_owner')
                  }
                  disabled={accountType === 'organization'}
                  className="sl-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm disabled:opacity-50"
                >
                  <option value="individual_owner">Asset Owner</option>
                  <option value="buyer">Buyer / Acquirer</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
            </div>

            {accountType === 'organization' && (
              <div>
                <label className="block text-xs font-medium text-secondary-token">Organization Name</label>
                <input
                  required
                  minLength={2}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs font-medium text-[#FB7185]">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full py-2.5">
              Create Account
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogleSignUp}
              className="w-full py-2.5"
            >
              Continue with Google
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-secondary-token">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-[#22D3EE] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
