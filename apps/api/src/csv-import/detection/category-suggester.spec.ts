import { describe, it, expect } from 'vitest';
import { CategorySuggester } from './category-suggester';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (cp = 'spotify'): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-01',
  amountCents: -999,
  counterparty: cp,
  counterpartyNorm: cp,
  purpose: '',
  purposeNorm: '',
  externalRef: null,
});

describe('CategorySuggester', () => {
  it('returns EXACT when matching active recurring name', () => {
    const s = new CategorySuggester(
      [{ nameNorm: 'spotify', categoryId: 'cat-abo' }],
      new Map(),
    );
    expect(s.suggest(row())).toEqual({ categoryId: 'cat-abo', confidence: 'EXACT' });
  });

  it('returns LEARNED when ImportLearning has entry', () => {
    const s = new CategorySuggester(
      [],
      new Map([['rewe', 'cat-food']]),
    );
    expect(s.suggest(row('rewe'))).toEqual({ categoryId: 'cat-food', confidence: 'LEARNED' });
  });

  it('prefers EXACT over LEARNED', () => {
    const s = new CategorySuggester(
      [{ nameNorm: 'spotify', categoryId: 'cat-abo' }],
      new Map([['spotify', 'cat-other']]),
    );
    expect(s.suggest(row())).toEqual({ categoryId: 'cat-abo', confidence: 'EXACT' });
  });

  it('returns NONE when no match', () => {
    const s = new CategorySuggester([], new Map());
    expect(s.suggest(row())).toEqual({ categoryId: null, confidence: 'NONE' });
  });
});
