'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch, formatLabel } from '@/lib/api';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  orgType: string;
  verificationStatus: string;
  isPersonal: boolean;
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);

  useEffect(() => {
    apiFetch<{ organizations: OrgRow[] }>('/admin/organizations').then((d) => setOrgs(d.organizations)).catch(() => {});
  }, []);

  return (
    <DashboardShell mode="admin" title="Organizations" subtitle="Tenant registry across studios, startups, and enterprise accounts.">
      <SurfaceCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-token bg-elevated text-xs text-muted-token">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Personal</th>
                <th className="px-4 py-3">Verification</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-primary-token">{o.name}</div>
                    <div className="font-mono text-xs text-muted-token">{o.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary-token">{formatLabel(o.orgType)}</td>
                  <td className="px-4 py-3 text-xs text-secondary-token">{o.isPersonal ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.verificationStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </DashboardShell>
  );
}
