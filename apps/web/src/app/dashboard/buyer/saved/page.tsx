'use client';

import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, EmptyState, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

interface SavedRow {
  savedId: string;
  assetId: string;
  assetName: string;
  primaryLanguage: string | null;
  declaredLicense: string;
}

export default function BuyerSavedPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<SavedRow[]>([]);

  const load = () =>
    apiFetch<{ savedAssets: SavedRow[] }>('/saved-assets').then((d) => setRows(d.savedAssets));

  useEffect(() => {
    load().catch(() => { });
  }, []);

  const remove = async (assetId: string) => {
    await apiFetch(`/saved-assets/${assetId}`, { method: 'DELETE' });
    pushToast('Removed from saved shortlist', 'info');
    await load();
  };

  return (
    <DashboardShell
      mode="buyer"
      title="Saved Assets"
      subtitle="Shortlisted digital assets under technical and commercial review."
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-6 w-6" />}
          title="No saved assets yet"
          description="Save assets from the Marketplace detail page to build your comparison shortlist."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <SurfaceCard key={r.savedId} className="flex items-center justify-between p-5">
              <div>
                <div className="text-base font-bold text-primary-token">{r.assetName}</div>
                <div className="text-xs text-secondary-token">
                  {r.primaryLanguage || 'Mixed'} • {r.declaredLicense}
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => remove(r.assetId)} className="px-3 py-1.5 text-xs">
                Remove
              </Button>
            </SurfaceCard>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
