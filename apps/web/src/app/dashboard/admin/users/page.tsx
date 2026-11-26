'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatLabel } from '@/lib/api';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  primaryRole: string;
  accountStatus: string;
  emailVerified: boolean;
}

export default function AdminUsersPage() {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = () => apiFetch<{ users: UserRow[] }>('/admin/users').then((d) => setUsers(d.users));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'suspended' : 'active';
    await apiFetch(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ accountStatus: next }),
    });
    pushToast(`User status updated to ${next}`, 'info');
    await load();
  };

  return (
    <DashboardShell mode="admin" title="User Management" subtitle="Inspect accounts, roles, and enforce account status controls.">
      <SurfaceCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-token bg-elevated text-xs text-muted-token">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Primary Role</th>
                <th className="px-4 py-3">Email Verified</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-primary-token">{u.fullName}</div>
                    <div className="text-xs text-muted-token">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary-token">{formatLabel(u.primaryRole)}</td>
                  <td className="px-4 py-3 text-xs text-secondary-token">{u.emailVerified ? 'Verified' : 'Unverified'}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.accountStatus} /></td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant={u.accountStatus === 'active' ? 'destructive' : 'secondary'}
                      onClick={() => toggleStatus(u.id, u.accountStatus)}
                      className="px-3 py-1 text-xs"
                    >
                      {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </DashboardShell>
  );
}
