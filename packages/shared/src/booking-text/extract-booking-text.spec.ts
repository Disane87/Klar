import { describe, it, expect } from 'vitest';
import { extractBookingText } from './extract-booking-text';

describe('extractBookingText', () => {
  it('returns null for empty input', () => {
    expect(extractBookingText(null)).toBeNull();
    expect(extractBookingText(undefined)).toBeNull();
    expect(extractBookingText('')).toBeNull();
    expect(extractBookingText('   ')).toBeNull();
  });

  it('extracts a trailing keyword from a stitched purpose', () => {
    const purpose =
      '028-5931719-5895503 AMZN Mktp DE NFYWADEAE7Y7PBRP FOLGELASTSCHRIFT';
    expect(extractBookingText(purpose)).toBe('FOLGELASTSCHRIFT');
  });

  it('prefers the longest match (FOLGELASTSCHRIFT over LASTSCHRIFT)', () => {
    expect(extractBookingText('xyz FOLGELASTSCHRIFT abc')).toBe(
      'FOLGELASTSCHRIFT',
    );
  });

  it('matches case-insensitively and returns canonical uppercase', () => {
    expect(extractBookingText('Gutschrift Gehalt')).toBe('GUTSCHRIFT');
  });

  it('respects word boundaries — does not match inside other words', () => {
    expect(extractBookingText('LASTSCHRIFTSTORNO')).toBeNull();
    expect(extractBookingText('XGUTSCHRIFTX')).toBeNull();
  });

  it('handles umlaut variants (UEBERWEISUNG / ÜBERWEISUNG)', () => {
    expect(extractBookingText('SEPA-UEBERWEISUNG xyz')).toBe(
      'SEPA-UEBERWEISUNG',
    );
    expect(extractBookingText('SEPA-Überweisung xyz')).toBe('SEPA-ÜBERWEISUNG');
  });

  it('returns null when no whitelisted keyword is present', () => {
    expect(extractBookingText('AMAZON PAYMENTS EUROPE S.C.A.')).toBeNull();
    expect(extractBookingText('EREF+1234 KREF+5678')).toBeNull();
  });

  it('extracts from multi-line FinTS purpose blobs', () => {
    const purpose = ['Miete Mai', 'EREF+ABC123', 'DAUERAUFTRAG'].join('\n');
    expect(extractBookingText(purpose)).toBe('DAUERAUFTRAG');
  });

  it('keeps SEPA-LASTSCHRIFT as a single token (not just LASTSCHRIFT)', () => {
    expect(extractBookingText('xx SEPA-LASTSCHRIFT yy')).toBe('SEPA-LASTSCHRIFT');
  });
});
