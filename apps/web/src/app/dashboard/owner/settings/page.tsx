'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatMoney } from '@/lib/api';

interface Member { memberId: string; email: string; fullName: string; role: string }
interface Workspace { id: string; name: string; slug: string }
interface Plan { code: string; name: string; monthlyPriceMinor: number; currency: string }

export default function OwnerSettingsPage() {
  const { user, activeOrganizationId, refreshUser } = useAuth();
  const { pushToast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [members, setMembers] = useState<Member[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanCode, setActivePlanCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [wsName, setWsName] = useState('');

  const loadOrgData = async () => {
    if (!activeOrganizationId) return;
    const [m, w, s, p] = await Promise.all([
      apiFetch<{ members: Member[] }>(`/organizations/${activeOrganizationId}/members`).catch(() => ({ members: [] })),
      apiFetch<{ workspaces: Workspace[] }>(`/organizations/${activeOrganizationId}/workspaces`).catch(() => ({ workspaces: [] })),
      apiFetch<{ subscription: { planCode: string } | null }>(`/organizations/${activeOrganizationId}/subscription`).catch(() => ({ subscription: null })),
      apiFetch<{ plans: Plan[] }>('/subscriptions/plans').catch(() => ({ plans: [] })),
    ]);
    setMembers(m.members);
    setWorkspaces(w.workspaces);
    setActivePlanCode(s.subscription?.planCode || '');
    setPlans(p.plans);
  };

  useEffect(() => {
    setFullName(user?.fullName || '');
    loadOrgData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId, user?.fullName]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ fullName }) });
    await refreshUser();
    pushToast('Profile updated', 'success');
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganizationId) return;
    await apiFetch(`/organizations/${activeOrganizationId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail, role: 'enterprise_member' }),
    });
    setInviteEmail('');
    pushToast('Team invitation issued', 'success');
    await loadOrgData();
  };

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganizationId) return;
    await apiFetch(`/organizations/${activeOrganizationId}/workspaces`, {
      method: 'POST',
      body: JSON.stringify({ name: wsName }),
    });
    setWsName('');
    pushToast('Workspace added', 'success');
    await loadOrgData();
  };

  const switchPlan = async (planCode: string) => {
    if (!activeOrganizationId) return;
    await apiFetch(`/organizations/${activeOrganizationId}/subscription`, {
      method: 'POST',
      body: JSON.stringify({ planCode }),
    });
    setActivePlanCode(planCode);
    pushToast(`Subscription updated to ${planCode}`, 'success');
  };

  return (
    <DashboardShell
      mode="owner"
      title="Account, Team & Workspace Settings"
      subtitle="Manage profile, organization members, workspaces, and subscription tier."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard className="p-6">
          <form onSubmit={updateProfile} className="space-y-3">
            <h2 className="text-base font-bold text-primary-token">Profile Settings</h2>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="sl-input w-full rounded-xl px-3.5 py-2 text-sm" />
            <Button type="submit" className="text-xs">Save Profile</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h2 className="text-base font-bold text-primary-token">Workspaces</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-secondary-token">
            {workspaces.map((w) => (
              <li key={w.id} className="rounded-xl border border-token bg-elevated px-3.5 py-2">{w.name}</li>
            ))}
          </ul>
          <form onSubmit={createWorkspace} className="mt-3 flex gap-2">
            <input required value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="New workspace name" className="sl-input flex-1 rounded-xl px-3 py-2 text-sm" />
            <Button type="submit" className="text-xs">Add</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h2 className="text-base font-bold text-primary-token">Team Members</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.memberId} className="flex items-center justify-between rounded-xl border border-token bg-elevated px-3.5 py-2">
                <span className="text-primary-token">{m.fullName} ({m.email})</span>
                <span className="text-xs font-semibold text-[#22D3EE]">{m.role}</span>
              </li>
            ))}
          </ul>
          <form onSubmit={inviteMember} className="mt-3 flex gap-2">
            <input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite colleague email" className="sl-input flex-1 rounded-xl px-3 py-2 text-sm" />
            <Button type="submit" variant="secondary" className="text-xs">Invite</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h2 className="text-base font-bold text-primary-token">Subscription Plan</h2>
          <div className="mt-3 space-y-2.5">
            {plans.map((p) => (
              <div key={p.code} className="flex items-center justify-between rounded-xl border border-token bg-elevated p-3.5 text-sm">
                <div>
                  <div className="font-semibold text-primary-token">{p.name}</div>
                  <div className="text-xs text-muted-token">
                    {p.monthlyPriceMinor === 0 ? 'Free' : `${formatMoney(p.monthlyPriceMinor, p.currency)}/mo`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={activePlanCode === p.code ? 'secondary' : 'primary'}
                  disabled={activePlanCode === p.code}
                  onClick={() => switchPlan(p.code)}
                  className="px-3 py-1.5 text-xs"
                >
                  {activePlanCode === p.code ? 'Current Plan' : 'Select'}
                </Button>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}
