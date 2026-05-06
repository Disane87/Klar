import { describe, it, expect } from 'vitest';
import { DuplicateDetector } from './duplicate-detector';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-15',
  amountCents: -1599,
  counterparty: 'REWE',
  counterpartyNorm: 'rewe',
  purpose: 'Kauf',
  purposeNorm: 'kauf',
  externalRef: 'ref-abc',
  ...overrides,
});

describe('DuplicateDetector', () => {
  it('flags row whose externalRef already exists', () => {
    const det = new DuplicateDetector(new Set(['ref-abc']), new Set());
    expect(det.isDuplicate(row())).toBe(true);
  });

  it('flags row whose hash matches when no externalRef', () => {
    const r = row({ externalRef: null });
    const det = new DuplicateDetector(new Set(), new Set([DuplicateDetector.computeHash(r)]));
    expect(det.isDuplicate(r)).toBe(true);
  });

  it('returns false when neither matches', () => {
    const det = new DuplicateDetector(new Set(['other']), new Set(['other-hash']));
    expect(det.isDuplicate(row({ externalRef: null }))).toBe(false);
  });

  it('different hashes for different counterparty', () => {
    const a = row({ externalRef: null, counterpartyNorm: 'rewe' });
    const b = row({ externalRef: null, counterpartyNorm: 'edeka' });
    expect(DuplicateDetector.computeHash(a)).not.toBe(DuplicateDetector.computeHash(b));
  });
});
