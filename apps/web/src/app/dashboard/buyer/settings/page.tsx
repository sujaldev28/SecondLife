'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

export default function BuyerSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { pushToast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [headline, setHeadline] = useState(user?.headline || '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName, headline }),
    });
    await refreshUser();
    pushToast('Buyer preferences saved', 'success');
  };

  return (
    <DashboardShell mode="buyer" title="Buyer Profile & Preferences" subtitle="Configure your acquisition profile and alerts.">
      <SurfaceCard className="max-w-lg p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary-token">Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-token">Role / Sourcing Focus</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <Button type="submit" className="text-xs">Save Preferences</Button>
        </form>
      </SurfaceCard>
    </DashboardShell>
  );
}
