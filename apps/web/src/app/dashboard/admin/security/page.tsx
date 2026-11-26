'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { SurfaceCard } from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminSecurityPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    apiFetch<{ auditLogs: AuditRow[] }>('/admin/security-events')
      .then((d) => setLogs(d.auditLogs))
      .catch(() => {});
  }, []);

  return (
    <DashboardShell
      mode="admin"
      title="Security & Immutable Audit Trail"
      subtitle="Review authentication, authorization, verification, agreement, and settlement events."
    >
      <SurfaceCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-token bg-elevated text-xs text-muted-token">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-token/60 transition hover:bg-surface-elevated">
                  <td className="px-4 py-2.5 text-xs text-muted-token">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#22D3EE]">{l.action}</td>
                  <td className="px-4 py-2.5 text-xs text-secondary-token">{l.resourceType} ({l.resourceId?.slice(0, 8) || '—'})</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-token">{l.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </DashboardShell>
  );
}
