export const ASSET_STATUSES = [
  'draft',
  'submitted',
  'ingestion_pending',
  'under_analysis',
  'verification_required',
  'under_review',
  'approved',
  'published',
  'interested',
  'negotiation',
  'under_transaction',
  'licensed',
  'transferred',
  'revival_in_progress',
  'archived',
  'rejected',
  'suspended',
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ALLOWED_ASSET_TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  draft: ['submitted', 'ingestion_pending', 'archived'],
  submitted: ['ingestion_pending', 'under_analysis', 'verification_required', 'rejected', 'archived'],
  ingestion_pending: ['under_analysis', 'verification_required', 'draft', 'rejected'],
  under_analysis: ['verification_required', 'under_review', 'rejected', 'suspended'],
  verification_required: ['under_review', 'under_analysis', 'rejected', 'archived'],
  under_review: ['approved', 'verification_required', 'rejected', 'suspended'],
  approved: ['published', 'under_review', 'archived', 'suspended'],
  published: ['interested', 'negotiation', 'under_transaction', 'revival_in_progress', 'archived', 'suspended'],
  interested: ['negotiation', 'published', 'under_transaction', 'archived', 'suspended'],
  negotiation: ['under_transaction', 'published', 'interested', 'revival_in_progress', 'archived', 'suspended'],
  under_transaction: ['licensed', 'transferred', 'revival_in_progress', 'negotiation', 'suspended'],
  licensed: ['published', 'negotiation', 'revival_in_progress', 'archived', 'suspended'],
  transferred: ['archived'],
  revival_in_progress: ['licensed', 'published', 'archived', 'suspended'],
  archived: ['draft', 'under_review'],
  rejected: ['draft', 'submitted', 'archived'],
  suspended: ['under_review', 'approved', 'archived'],
};

export function canTransitionAssetStatus(from: AssetStatus, to: AssetStatus): boolean {
  if (from === to) return true;
  return ALLOWED_ASSET_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertAssetTransition(from: AssetStatus, to: AssetStatus): void {
  if (!canTransitionAssetStatus(from, to)) {
    throw new Error(`Invalid asset lifecycle transition from '${from}' to '${to}'`);
  }
}

export const ASSET_TYPES = [
  'source_code',
  'web_application',
  'library_sdk',
  'algorithm_model',
  'developer_tool',
  'research_prototype',
  'api_service',
  'documentation_dataset',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const LISTING_TYPES = [
  'non_exclusive_license',
  'exclusive_license',
  'full_transfer',
  'revival_partnership',
  'repurposing_partnership',
] as const;

export type ListingType = (typeof LISTING_TYPES)[number];
