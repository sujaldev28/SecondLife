'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch, formatMoney } from '@/lib/api';

interface Requirement {
  id: string;
  title: string;
  description: string;
  requiredTechnologies: string[];
  preferredCategories: string[];
  minTechnicalScore: number;
  maxBudgetMinor: number | null;
}

export default function BuyerRequirementsPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techsRaw, setTechsRaw] = useState('TypeScript, PostgreSQL');
  const [categorySlug, setCategorySlug] = useState('fintech-billing');
  const [minScore, setMinScore] = useState('70');
  const [maxBudgetInr, setMaxBudgetInr] = useState('500000');

  const load = () =>
    apiFetch<{ requirements: Requirement[] }>('/buyer/requirements').then((d) => setReqs(d.requirements));

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const createReq = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/buyer/requirements', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        preferredCategories: [categorySlug],
        requiredTechnologies: techsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        minTechnicalScore: Number(minScore),
        maxBudgetMinor: Math.round(Number(maxBudgetInr) * 100),
      }),
    });
    setTitle('');
    setDescription('');
    pushToast('Requirement saved! Computing explainable matches...', 'success');
    await load();
    router.push('/dashboard/buyer/recommendations');
  };

  return (
    <DashboardShell
      mode="buyer"
      title="Buyer Requirements"
      subtitle="Define your technical, licensing, and budget profile to trigger explainable asset matching."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard className="p-6">
          <form onSubmit={createReq} className="space-y-4">
            <h2 className="text-base font-bold text-primary-token">New Sourcing Requirement</h2>
            <input required minLength={5} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Requirement Title" className="sl-input w-full rounded-xl px-3.5 py-2 text-sm" />
            <textarea required minLength={20} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe target capabilities and integration constraints..." className="sl-input w-full rounded-xl px-3.5 py-2 text-sm" />
            <input value={techsRaw} onChange={(e) => setTechsRaw(e.target.value)} placeholder="Required technologies (comma separated)" className="sl-input w-full rounded-xl px-3.5 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="sl-input rounded-xl px-2.5 py-2 text-xs">
                <option value="fintech-billing">FinTech &amp; Billing</option>
                <option value="developer-tools">Developer Tools</option>
                <option value="devops-security">DevOps &amp; Security</option>
                <option value="ai-ml-algorithms">AI &amp; ML</option>
                <option value="saas-applications">SaaS Apps</option>
              </select>
              <input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Min Tech Score" className="sl-input rounded-xl px-2.5 py-2 text-xs" />
              <input type="number" value={maxBudgetInr} onChange={(e) => setMaxBudgetInr(e.target.value)} placeholder="Max INR" className="sl-input rounded-xl px-2.5 py-2 text-xs" />
            </div>
            <Button type="submit">Save &amp; Compute Matches</Button>
          </form>
        </SurfaceCard>

        <div className="space-y-3">
          {reqs.map((r) => (
            <SurfaceCard key={r.id} className="p-5">
              <div className="text-base font-bold text-primary-token">{r.title}</div>
              <p className="mt-1 text-xs text-secondary-token">{r.description}</p>
              <div className="mt-2.5 text-xs text-muted-token">
                Stack: <span className="text-[#22D3EE]">{r.requiredTechnologies.join(', ')}</span> • Min Score: {r.minTechnicalScore} • Max Budget:{' '}
                {formatMoney(r.maxBudgetMinor)}
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
