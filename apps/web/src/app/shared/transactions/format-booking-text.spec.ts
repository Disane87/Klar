import { describe, it, expect } from 'vitest';
import { formatBookingText } from './format-booking-text';

describe('formatBookingText', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(formatBookingText(null)).toBe('');
    expect(formatBookingText(undefined)).toBe('');
    expect(formatBookingText('  ')).toBe('');
  });

  it('title-cases all-caps single word', () => {
    expect(formatBookingText('FOLGELASTSCHRIFT')).toBe('Folgelastschrift');
    expect(formatBookingText('GUTSCHRIFT')).toBe('Gutschrift');
  });

  it('keeps short acronyms uppercase', () => {
    expect(formatBookingText('BARGELDAUSZAHLUNG GA')).toBe('Bargeldauszahlung GA');
    expect(formatBookingText('SEPA-LASTSCHRIFT')).toBe('Sepa-lastschrift');
  });

  it('handles already title-cased strings without breaking', () => {
    expect(formatBookingText('Folgelastschrift')).toBe('Folgelastschrift');
  });
});
