import { describe, it, expect } from 'vitest';
import { formatDateLocal } from './dateUtils';

describe('formatDateLocal', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(formatDateLocal(new Date(2024, 0, 15))).toBe('2024-01-15');
  });

  it('does not return the previous day (timezone-safe)', () => {
    // new Date('2024-01-15') is UTC midnight — in UTC+2 it rolls back to Jan 14 via toISOString().
    // formatDateLocal uses local getters so it always reflects the correct calendar day.
    const date = new Date(2024, 0, 15); // local midnight — no UTC shift
    expect(formatDateLocal(date)).toBe('2024-01-15');
  });

  it('handles end-of-month correctly', () => {
    expect(formatDateLocal(new Date(2024, 0, 31))).toBe('2024-01-31');
  });

  it('handles end-of-year correctly', () => {
    expect(formatDateLocal(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  it('pads single-digit month and day with leading zero', () => {
    expect(formatDateLocal(new Date(2024, 2, 5))).toBe('2024-03-05');
  });
});
