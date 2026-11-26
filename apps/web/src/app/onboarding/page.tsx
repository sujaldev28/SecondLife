'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { pushToast } = useToast();
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState('startup');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, orgType, website, description }),
      });
      await refreshUser();
      pushToast(`Organization "${name}" created`, 'success');
      router.push('/dashboard/owner');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="sl-card w-full max-w-lg rounded-2xl p-8 animate-sl-in">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
            <Building2 className="h-4 w-4" />
            Organization Setup
          </div>
          <h1 className="mt-2 text-2xl font-bold text-primary-token">Organization Onboarding</h1>
          <p className="mt-1 text-sm text-secondary-token">
            Create an organization workspace for multi-user asset governance and deal execution.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary-token">Organization Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Organization Type</label>
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                <option value="startup">Startup</option>
                <option value="enterprise">Enterprise</option>
                <option value="studio">Engineering Studio</option>
                <option value="research">Research Institution</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Website (optional)</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Summary</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs text-[#FB7185]">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full py-2.5">
              Create Organization Workspace
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
