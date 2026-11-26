'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, FileArchive, UploadCloud } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, SurfaceCard } from '@/components/ui/Primitives';
import { useToast } from '@/components/ToastContext';
import { apiFetch } from '@/lib/api';

interface Category {
  id: string;
  slug: string;
  name: string;
}

const STEPS = [
  'Asset Information',
  'Source & Archive',
  'Technology Details',
  'Ownership & Rights',
  'Documentation',
  'Review & Submit',
];

const DRAFT_STORAGE_KEY = 'secondlife_submit_draft_v1';

export default function SubmitAssetPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form fields
  const [name, setName] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [description, setDescription] = useState('');
  const [assetType, setAssetType] = useState('api_service');
  const [categorySlug, setCategorySlug] = useState('developer-tools');
  const [repositoryProvider, setRepositoryProvider] = useState('manual');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState('TypeScript');
  const [techStackRaw, setTechStackRaw] = useState('TypeScript, Node.js, PostgreSQL');
  const [versionTag, setVersionTag] = useState('1.0.0');
  const [declaredLicense, setDeclaredLicense] = useState('Proprietary Commercial Transfer');
  const [claimantType, setClaimantType] = useState('corporate_owner');
  const [contributorsSummary, setContributorsSummary] = useState('');
  const [submitDeclarationNow, setSubmitDeclarationNow] = useState(false);
  const [attestationAccepted, setAttestationAccepted] = useState(false);
  const [documentationNotes, setDocumentationNotes] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/categories')
      .then((d) => {
        setCategories(d.categories);
        if (d.categories[0]) setCategorySlug((prev) => prev || d.categories[0].slug);
      })
      .catch(() => {});

    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setName(parsed.name);
        if (parsed.shortSummary) setShortSummary(parsed.shortSummary);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.primaryLanguage) setPrimaryLanguage(parsed.primaryLanguage);
        if (parsed.techStackRaw) setTechStackRaw(parsed.techStackRaw);
        if (parsed.declaredLicense) setDeclaredLicense(parsed.declaredLicense);
        if (parsed.documentationNotes) setDocumentationNotes(parsed.documentationNotes);
      }
    } catch {
      // Ignore invalid local draft
    }
  }, []);

  // Autosave draft metadata
  useEffect(() => {
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          name,
          shortSummary,
          description,
          primaryLanguage,
          techStackRaw,
          declaredLicense,
          documentationNotes,
        }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [name, shortSummary, description, primaryLanguage, techStackRaw, declaredLicense, documentationNotes]);

  const validateStep = (idx: number): boolean => {
    setError('');
    if (idx === 0) {
      if (name.trim().length < 3) {
        setError('Asset name must be at least 3 characters.');
        return false;
      }
      if (description.trim().length < 20) {
        setError('Technical & business description must be at least 20 characters.');
        return false;
      }
    }
    if (idx === 3 && submitDeclarationNow && !attestationAccepted) {
      setError('Accept the ownership attestation checkbox or disable immediate verification submission.');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(3)) return;
    setError('');
    setSubmitting(true);
    try {
      const created = await apiFetch<{ asset: { id: string } }>('/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          shortSummary: shortSummary.trim() || undefined,
          description: description.trim(),
          assetType,
          categorySlug,
          repositoryProvider,
          repositoryUrl: repositoryUrl.trim() || undefined,
          primaryLanguage: primaryLanguage.trim() || undefined,
          techStack: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean),
          declaredLicense: declaredLicense.trim(),
          versionTag: versionTag.trim() || '1.0.0',
          documentationNotes: documentationNotes.trim() || undefined,
        }),
      });

      if (archiveFile) {
        const fd = new FormData();
        fd.append('archive', archiveFile);
        fd.append('versionTag', versionTag.trim() || '1.0.0');
        await apiFetch(`/assets/${created.asset.id}/upload-archive`, {
          method: 'POST',
          body: fd,
        });
      }

      if (repositoryUrl.trim()) {
        await apiFetch(`/assets/${created.asset.id}/sync-repository`, { method: 'POST' }).catch(() => {});
      }

      if (submitDeclarationNow && attestationAccepted) {
        await apiFetch(`/assets/${created.asset.id}/ownership-declaration`, {
          method: 'POST',
          body: JSON.stringify({
            claimantType,
            ownershipPercentage: 100,
            hasThirdPartyCode: false,
            contributorsSummary,
            evidenceNotes: evidenceNotes || documentationNotes,
            attestationAccepted: true,
          }),
        });
      }

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      pushToast('Asset submitted! Ready for evaluation.', 'success');
      router.push('/dashboard/owner/analysis');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell
      mode="owner"
      title="Submit Digital Asset"
      subtitle="6-step guided onboarding with autosave, safe ZIP inspection, and optional verification submission."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Stepper */}
        <SurfaceCard className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            {STEPS.map((label, idx) => {
              const done = idx < step;
              const current = idx === step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => idx <= step && setStep(idx)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition cursor-pointer ${
                    current
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-primary-token font-semibold'
                      : done
                        ? 'border-[#34D399]/35 bg-[#34D399]/10 text-[#34D399]'
                        : 'border-token bg-elevated text-muted-token'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                    {done ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-primary-token">1. Asset Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Asset Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., KathaLedger GST Engine"
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Category *</label>
                  <select
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Asset Type</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    <option value="api_service">API / Backend Service</option>
                    <option value="web_application">Web Application</option>
                    <option value="library_sdk">Library / SDK</option>
                    <option value="developer_tool">Developer Tool</option>
                    <option value="algorithm_model">AI / ML Algorithm</option>
                    <option value="research_prototype">Research Prototype</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Short Summary</label>
                  <input
                    value={shortSummary}
                    onChange={(e) => setShortSummary(e.target.value)}
                    placeholder="One-line commercial pitch"
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-token">
                  Technical &amp; Business Description * (min 20 chars)
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe architecture, origin, dormancy context, and reusable capabilities..."
                  className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-primary-token">2. Repository or Archive Source</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Source Provider</label>
                  <select
                    value={repositoryProvider}
                    onChange={(e) => setRepositoryProvider(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    <option value="manual">Manual / Archive Upload</option>
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                    <option value="bitbucket">Bitbucket</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-token">HTTPS Repository URL (optional)</label>
                  <input
                    type="url"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setArchiveFile(f);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  dragActive ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' : 'border-token bg-elevated'
                }`}
              >
                <UploadCloud className="h-8 w-8 text-[#22D3EE]" />
                <p className="mt-3 text-sm font-semibold text-primary-token">
                  Drag &amp; drop a `.zip` project archive here
                </p>
                <p className="mt-1 text-xs text-muted-token">
                  Inspected safely against Zip Slip, zip bombs, and secrets. Never executed on app servers.
                </p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-token bg-surface px-4 py-2 text-xs font-semibold text-primary-token hover:bg-surface-elevated">
                  Choose ZIP File
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => setArchiveFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {archiveFile && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#34D399]/35 bg-[#34D399]/10 px-3 py-1.5 text-xs text-[#34D399]">
                    <FileArchive className="h-3.5 w-3.5" />
                    {archiveFile.name} ({Math.round(archiveFile.size / 1024)} KB)
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-primary-token">3. Technology Stack &amp; Versioning</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Primary Language</label>
                  <input
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Initial Version Tag</label>
                  <input
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-token">Technology Stack (comma separated)</label>
                <input
                  value={techStackRaw}
                  onChange={(e) => setTechStackRaw(e.target.value)}
                  className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-primary-token">4. Ownership &amp; Licensing</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Declared License</label>
                  <input
                    value={declaredLicense}
                    onChange={(e) => setDeclaredLicense(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-token">Claimant Capacity</label>
                  <select
                    value={claimantType}
                    onChange={(e) => setClaimantType(e.target.value)}
                    className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    <option value="corporate_owner">Corporate IP Owner</option>
                    <option value="sole_author">Sole Author</option>
                    <option value="authorized_representative">Authorized Representative</option>
                    <option value="co_owner">Co-Owner</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-token">Contributors Summary</label>
                <textarea
                  rows={2}
                  value={contributorsSummary}
                  onChange={(e) => setContributorsSummary(e.target.value)}
                  placeholder="Describe contributor IP assignment or co-author status..."
                  className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-secondary-token">
                <input
                  type="checkbox"
                  checked={submitDeclarationNow}
                  onChange={(e) => setSubmitDeclarationNow(e.target.checked)}
                />
                Submit Ownership Verification Request immediately upon asset creation
              </label>
              {submitDeclarationNow && (
                <label className="flex items-start gap-2 rounded-xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/10 p-3 text-xs text-primary-token">
                  <input
                    type="checkbox"
                    checked={attestationAccepted}
                    onChange={(e) => setAttestationAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I legally attest that I/my organization hold authority to commercialize this digital asset.
                  </span>
                </label>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-primary-token">5. Supporting Documentation &amp; Evidence</h2>
              <div>
                <label className="block text-xs font-medium text-secondary-token">Architecture / Setup Notes</label>
                <textarea
                  rows={4}
                  value={documentationNotes}
                  onChange={(e) => setDocumentationNotes(e.target.value)}
                  placeholder="Include README highlights, deployment dependencies, or test instructions..."
                  className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-token">Ownership Evidence Notes</label>
                <textarea
                  rows={2}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="Reference corporate IP assignment records, domain ownership, or commit logs..."
                  className="sl-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-primary-token">6. Review &amp; Submit</h2>
              <div className="grid gap-3 rounded-xl border border-token bg-elevated p-4 text-xs sm:grid-cols-2">
                <div><span className="text-muted-token">Asset Name:</span> <strong className="text-primary-token">{name}</strong></div>
                <div><span className="text-muted-token">Category:</span> <strong className="text-primary-token">{categorySlug}</strong></div>
                <div><span className="text-muted-token">Language:</span> <strong className="text-primary-token">{primaryLanguage}</strong></div>
                <div><span className="text-muted-token">License:</span> <strong className="text-primary-token">{declaredLicense}</strong></div>
                <div><span className="text-muted-token">Archive:</span> <strong className="text-primary-token">{archiveFile ? archiveFile.name : 'None attached'}</strong></div>
                <div><span className="text-muted-token">Auto-Submit Verification:</span> <strong className="text-primary-token">{submitDeclarationNow ? 'Yes' : 'No (Draft)'}</strong></div>
              </div>
              <p className="text-xs text-secondary-token">
                Draft progress is autosaved locally until submission. Once created, you can trigger the AI &amp; static evaluation pipeline immediately.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/12 p-3 text-xs font-medium text-[#FB7185]">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-token pt-5">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Previous
            </Button>

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep}>
                Continue
              </Button>
            ) : (
              <Button type="button" loading={submitting} onClick={handleSubmit}>
                Submit Asset to Registry
              </Button>
            )}
          </div>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}
