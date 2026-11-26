import { describe, expect, it } from 'vitest';
import { formatLabel, formatMoney } from '../lib/api';

describe('Web formatting helpers', () => {
  it('formats minor currency units accurately for INR and USD', () => {
    expect(formatMoney(45000000, 'INR')).toContain('4,50,000');
    expect(formatMoney(null)).toBe('—');
  });

  it('formats snake_case statuses into title labels', () => {
    expect(formatLabel('verification_required')).toBe('Verification Required');
    expect(formatLabel('non_exclusive_license')).toBe('Non Exclusive License');
  });
});
