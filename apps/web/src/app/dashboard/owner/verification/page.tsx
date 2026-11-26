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
  declaredLicense: string;
}

export default function OwnerVerificationPage() {
  const { pushToast } = useToast();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [claimantType, setClaimantType] = useState('corporate_owner');
  const [hasThirdPartyCode, setHasThirdPartyCode] = useState(false);
  const [contributorsSummary, setContributorsSummary] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [attestationAccepted, setAttestationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadAssets = () =>
    apiFetch<{ assets: AssetItem[] }>('/assets').then((d) => {
      setAssets(d.assets);
      if (!selectedId && d.assets[0]) setSelectedId(d.assets[0].id);
    });

  useEffect(() => {
    loadAssets().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch(`/assets/${selectedId}/ownership-declaration`, {
        method: 'POST',
        body: JSON.stringify({
          claimantType,
          ownershipPercentage: 100,
          hasThirdPartyCode,
          contributorsSummary,
          evidenceNotes,
          attestationAccepted,
        }),
      });
      pushToast('Ownership declaration submitted to Verification Queue', 'success');
      await loadAssets();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell
      mode="owner"
      title="Ownership & Rights Verification"
      subtitle="Submit legal ownership declarations, contributor disclosures, and supporting evidence."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-base font-bold text-primary-token">Submit Ownership Declaration</h2>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Asset</label>
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
              <label className="block text-xs font-medium text-secondary-token">Claimant Capacity</label>
              <select
                value={claimantType}
                onChange={(e) => setClaimantType(e.target.value)}
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              >
                <option value="sole_author">Sole Author</option>
                <option value="corporate_owner">Corporate IP Owner</option>
                <option value="authorized_representative">Authorized Representative</option>
                <option value="co_owner">Co-Owner (requires joint sign-off)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">
                Contributors &amp; IP Assignment Summary
              </label>
              <textarea
                rows={2}
                value={contributorsSummary}
                onChange={(e) => setContributorsSummary(e.target.value)}
                placeholder="List contributors or employee IP assignment status..."
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary-token">Supporting Evidence Notes</label>
              <textarea
                rows={3}
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Reference corporate resolutions, domain records, or commit history..."
                className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-secondary-token">
              <input
                type="checkbox"
                checked={hasThirdPartyCode}
                onChange={(e) => setHasThirdPartyCode(e.target.checked)}
              />
              Contains third-party or copyleft dependencies requiring license notice
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-token bg-elevated p-3.5 text-xs text-secondary-token">
              <input
                type="checkbox"
                required
                checked={attestationAccepted}
                onChange={(e) => setAttestationAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I legally attest that I/my organization hold authority to commercialize this asset and
                that all contributor &amp; open-source disclosures are accurate.
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs text-[#FB7185]">
                {error}
              </div>
            )}

            <Button type="submit" loading={submitting} disabled={!selectedId}>
              Submit for Specialist Verification
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h2 className="text-base font-bold text-primary-token">Verification Status by Asset</h2>
          <div className="mt-4 space-y-3">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-token bg-elevated p-3.5">
                <div>
                  <div className="text-sm font-semibold text-primary-token">{a.name}</div>
                  <div className="text-xs text-muted-token">License: {a.declaredLicense}</div>
                </div>
                <StatusBadge status={a.verificationStatus} />
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}
