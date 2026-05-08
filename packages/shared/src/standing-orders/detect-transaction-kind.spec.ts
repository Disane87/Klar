import { describe, it, expect } from 'vitest';
import { detectTransactionKind } from './detect-transaction-kind';

describe('detectTransactionKind', () => {
  it('returns STANDING_ORDER for MT940 GVC 158', () => {
    expect(detectTransactionKind({ bookingType: '158' })).toBe('STANDING_ORDER');
  });

  it('returns STANDING_ORDER for MT940 GVC 159', () => {
    expect(detectTransactionKind({ bookingType: '159' })).toBe('STANDING_ORDER');
  });

  it('returns STANDING_ORDER for MT940 GVC 164', () => {
    expect(detectTransactionKind({ bookingType: '164' })).toBe('STANDING_ORDER');
  });

  it('returns STANDING_ORDER for MT940 GVC 166', () => {
    expect(detectTransactionKind({ bookingType: '166' })).toBe('STANDING_ORDER');
  });

  it('returns STANDING_ORDER for CAMT SubFamily STDO', () => {
    expect(detectTransactionKind({ bookingType: 'STDO' })).toBe('STANDING_ORDER');
  });

  it('falls back to free-text "Dauerauftrag" when bookingType absent', () => {
    expect(
      detectTransactionKind({ bookingType: undefined, purposeRaw: 'Dauerauftrag Miete Mai' }),
    ).toBe('STANDING_ORDER');
  });

  it('matches "Dauerauftrag" case-insensitively', () => {
    expect(
      detectTransactionKind({ bookingType: undefined, purposeRaw: 'DAUERAUFTRAG GEZ' }),
    ).toBe('STANDING_ORDER');
  });

  it('returns DIRECT_DEBIT for GVC 005 / SEPA Lastschrift', () => {
    expect(detectTransactionKind({ bookingType: '005' })).toBe('DIRECT_DEBIT');
  });

  it('returns DIRECT_DEBIT for CAMT DDBE', () => {
    expect(detectTransactionKind({ bookingType: 'DDBE' })).toBe('DIRECT_DEBIT');
  });

  it('returns TRANSFER for GVC 020 (single transfer)', () => {
    expect(detectTransactionKind({ bookingType: '020' })).toBe('TRANSFER');
  });

  it('returns CARD for GVC 105 / 109 (Kartenzahlung)', () => {
    expect(detectTransactionKind({ bookingType: '105' })).toBe('CARD');
  });

  it('returns FEE for GVC 808 / 809', () => {
    expect(detectTransactionKind({ bookingType: '808' })).toBe('FEE');
  });

  it('returns OTHER when no rule matches', () => {
    expect(detectTransactionKind({ bookingType: '999' })).toBe('OTHER');
    expect(detectTransactionKind({})).toBe('OTHER');
  });

  it('matches German compound words containing the "Dauerauftr-" prefix', () => {
    expect(
      detectTransactionKind({ purposeRaw: 'Daueraufträgliche Sonderaktion 2026' }),
    ).toBe('STANDING_ORDER');
  });
});
