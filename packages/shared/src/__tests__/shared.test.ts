import { describe, expect, it } from 'vitest';
import {
  assertAssetTransition,
  canTransitionAssetStatus,
  hasPermission,
  resolvePermissions,
} from '../index.js';

describe('RBAC permissions', () => {
  it('grants asset creation to individual_owner but not admin settings', () => {
    expect(hasPermission(['individual_owner'], 'asset:create')).toBe(true);
    expect(hasPermission(['individual_owner'], 'admin:settings')).toBe(false);
  });

  it('grants verification approval to verification_specialist but not buyer', () => {
    expect(hasPermission(['verification_specialist'], 'verification:approve')).toBe(true);
    expect(hasPermission(['buyer'], 'verification:approve')).toBe(false);
  });

  it('supports super_admin having full permissions and extra permissions', () => {
    const perms = resolvePermissions(['buyer'], ['analysis:override']);
    expect(perms.has('analysis:override')).toBe(true);
    expect(hasPermission(['super_admin'], ['admin:security', 'transaction:refund'])).toBe(true);
  });
});

describe('Asset lifecycle state machine', () => {
  it('allows valid progression from draft -> submitted -> under_analysis -> verification_required -> under_review -> approved -> published', () => {
    expect(canTransitionAssetStatus('draft', 'submitted')).toBe(true);
    expect(canTransitionAssetStatus('submitted', 'under_analysis')).toBe(true);
    expect(canTransitionAssetStatus('under_analysis', 'verification_required')).toBe(true);
    expect(canTransitionAssetStatus('verification_required', 'under_review')).toBe(true);
    expect(canTransitionAssetStatus('under_review', 'approved')).toBe(true);
    expect(canTransitionAssetStatus('approved', 'published')).toBe(true);
  });

  it('rejects skipping verification to go directly from draft to published', () => {
    expect(canTransitionAssetStatus('draft', 'published')).toBe(false);
    expect(() => assertAssetTransition('draft', 'published')).toThrow(/Invalid asset lifecycle/);
  });
});
