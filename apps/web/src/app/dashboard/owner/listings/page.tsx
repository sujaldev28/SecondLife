'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

interface AssetItem {
  id: string;
  assetCode: string;
  name: string;
  verificationStatus: string;
  technicalEvalStatus: string;
  marketplaceStatus: string;
}

export default function OwnerListingsPage() {
  const { pushToast } = useToast();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [listingType, setListingType] = useState('non_exclusive_license');
  const [askingPriceInr, setAskingPriceInr] = useState('250000');
  const [commercialTerms, setCommercialTerms] = useState(
    'Includes verified source release, technical evaluation report, and 30-day handover support.',
  );
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    apiFetch<{ assets: AssetItem[] }>('/assets').then((d) => {
      setAssets(d.assets);
      const eligible = d.assets.find(
        (a) => a.verificationStatus === 'verified' && a.technicalEvalStatus === 'completed',
      );
      if (eligible) setSelectedId(eligible.id);
      else if (d.assets[0]) setSelectedId(d.assets[0].id);
    });

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPublishing(true);
    try {
      await apiFetch(`/assets/${selectedId}/publish-listing`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          summary,
          listingType,
          currency: 'INR',
          askingPriceMinor: Math.round(Number(askingPriceInr) * 100),
          commercialTerms,
          exclusivityAvailable: listingType !== 'non_exclusive_license',
          supportIncludedDays: 30,
        }),
      });
      pushToast('Marketplace listing published!', 'success');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <DashboardShell
      mode="owner"
      title="Marketplace Listings"
      subtitle="Publish assets that have cleared both technical intelligence and ownership verification."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard className="p-6">
          <form onSubmit={handlePublish} className="space-y-4">
            <h2 className="text-base font-bold text-primary-token">Publish Verified Asset</h2>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Select Asset</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} — {a.name} ({a.verificationStatus})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Listing Title</label>
              <input
                required
                minLength={5}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-secondary-token">Deal Arrangement</label>
                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                  className="sl-input mt-1.5 w-full rounded-xl px-3 py-2 text-sm"
                >
                  <option value="non_exclusive_license">Non-Exclusive License</option>
                  <option value="exclusive_license">Exclusive License</option>
                  <option value="full_transfer">Full Asset Transfer</option>
                  <option value="revival_partnership">Revival Partnership</option>
                  <option value="repurposing_partnership">Repurposing Partnership</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-token">Asking Price (INR)</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={askingPriceInr}
                  onChange={(e) => setAskingPriceInr(e.target.value)}
                  className="sl-input mt-1.5 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Executive Summary</label>
              <textarea
                required
                minLength={20}
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Commercial Terms</label>
              <textarea
                required
                minLength={10}
                rows={2}
                value={commercialTerms}
                onChange={(e) => setCommercialTerms(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs text-[#FB7185]">
                {error}
              </div>
            )}

            <Button type="submit" loading={publishing} disabled={!selectedId}>
              Publish to Marketplace
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h2 className="text-base font-bold text-primary-token">Publication Eligibility</h2>
          <div className="mt-4 space-y-3">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-token bg-elevated p-3.5">
                <div>
                  <div className="text-sm font-semibold text-primary-token">{a.name}</div>
                  <div className="text-xs text-muted-token">
                    Eval: {a.technicalEvalStatus} • Verification: {a.verificationStatus}
                  </div>
                </div>
                <StatusBadge status={a.marketplaceStatus} />
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}
