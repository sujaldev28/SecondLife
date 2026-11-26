'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

interface SettingRow {
  settingKey: string;
  settingValue: unknown;
  description: string;
}

export default function AdminSettingsPage() {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [licenseBps, setLicenseBps] = useState('1000');
  const [transferBps, setTransferBps] = useState('800');

  const load = () =>
    apiFetch<{ settings: SettingRow[] }>('/admin/settings').then((d) => {
      setSettings(d.settings);
      const comm = d.settings.find((s) => s.settingKey === 'pricing.commission_bps');
      const val = (comm?.settingValue as Record<string, number> | undefined) ?? {};
      if (val.non_exclusive_license) setLicenseBps(String(val.non_exclusive_license));
      if (val.full_transfer) setTransferBps(String(val.full_transfer));
    });

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const saveCommissions = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/admin/settings/pricing.commission_bps', {
      method: 'PUT',
      body: JSON.stringify({
        settingValue: {
          non_exclusive_license: Number(licenseBps),
          exclusive_license: Number(licenseBps),
          full_transfer: Number(transferBps),
          revival_partnership: 1200,
          repurposing_partnership: 1000,
        },
      }),
    });
    pushToast('Commission rules updated in PostgreSQL', 'success');
    await load();
  };

  return (
    <DashboardShell
      mode="admin"
      title="System & Commercial Settings"
      subtitle="Configure platform commission basis points, evaluation fees, and discovery parameters."
    >
      <SurfaceCard className="max-w-xl p-6">
        <form onSubmit={saveCommissions} className="space-y-4">
          <h2 className="text-base font-bold text-primary-token">
            Commission Rates (Basis Points: 100 bps = 1%)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary-token">Licensing Commission (bps)</label>
              <input type="number" value={licenseBps} onChange={(e) => setLicenseBps(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-token">Full Transfer Commission (bps)</label>
              <input type="number" value={transferBps} onChange={(e) => setTransferBps(e.target.value)} className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm" />
            </div>
          </div>
          <Button type="submit" className="text-xs">Save Commercial Rules</Button>
        </form>
      </SurfaceCard>

      <div className="mt-6 space-y-3">
        {settings.map((s) => (
          <SurfaceCard key={s.settingKey} className="p-4 text-xs">
            <div className="font-mono font-semibold text-[#22D3EE]">{s.settingKey}</div>
            <div className="mt-0.5 text-secondary-token">{s.description}</div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-token bg-elevated p-3 font-mono text-[11px] text-primary-token">
              {JSON.stringify(s.settingValue, null, 2)}
            </pre>
          </SurfaceCard>
        ))}
      </div>
    </DashboardShell>
  );
}
