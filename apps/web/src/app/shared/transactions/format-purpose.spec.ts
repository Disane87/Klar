import { describe, it, expect } from 'vitest';
import { formatPurpose } from './format-purpose';

describe('formatPurpose', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(formatPurpose(null)).toBe('');
    expect(formatPurpose(undefined)).toBe('');
    expect(formatPurpose('')).toBe('');
  });

  it('strips SEPA reference lines and joins on space', () => {
    const raw = [
      'Edeka Sagt Danke',
      'EREF+ABC123',
      'MREF+M-456',
      'LASTSCHRIFT',
    ].join('\n');
    expect(formatPurpose(raw)).toBe('Edeka Sagt Danke LASTSCHRIFT');
  });

  it('collapses whitespace', () => {
    expect(formatPurpose('  foo   \n\n  bar  ')).toBe('foo bar');
  });

  it('keeps the line if SEPA prefix is somewhere in the middle', () => {
    expect(formatPurpose('Order EREF+123 paid')).toBe('Order EREF+123 paid');
  });
});
