import { describe, it, expect } from 'vitest';
import { RecurringSuggester, type HistoryEntry } from './recurring-suggester';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-15',
  amountCents: -1299,
  counterparty: 'Netflix',
  counterpartyNorm: 'netflix',
  purpose: 'Abo',
  purposeNorm: 'abo',
  externalRef: null,
  ...overrides,
});

const hist = (date: string, amount = -1299): HistoryEntry => ({
  counterpartyNorm: 'netflix',
  date,
  amountCents: amount,
});

describe('RecurringSuggester', () => {
  it('suggests MONTHLY when 4 monthly entries within tolerance', () => {
    const s = new RecurringSuggester([
      hist('2025-12-15'),
      hist('2026-01-15'),
      hist('2026-02-15'),
      hist('2026-03-15'),
    ]);
    expect(s.suggest(row())?.estimatedFrequency).toBe('MONTHLY');
  });

  it('returns null when fewer than 3 occurrences', () => {
    const s = new RecurringSuggester([hist('2026-01-15'), hist('2026-02-15')]);
    expect(s.suggest(row())).toBeNull();
  });

  it('suggests QUARTERLY for 3-month spacing', () => {
    const s = new RecurringSuggester([
      hist('2025-04-15'),
      hist('2025-07-15'),
      hist('2025-10-15'),
    ]);
    expect(s.suggest(row())?.estimatedFrequency).toBe('QUARTERLY');
  });

  it('suggests YEARLY for 12-month spacing', () => {
    const s = new RecurringSuggester([
      hist('2023-04-15'),
      hist('2024-04-15'),
      hist('2025-04-15'),
    ]);
    expect(s.suggest(row())?.estimatedFrequency).toBe('YEARLY');
  });

  it('returns null for irregular spacing', () => {
    const s = new RecurringSuggester([
      hist('2026-01-01'),
      hist('2026-01-20'),
      hist('2026-03-15'),
    ]);
    expect(s.suggest(row())).toBeNull();
  });

  it('rejects entries outside 5% amount tolerance', () => {
    const s = new RecurringSuggester([
      hist('2026-01-15', -2000),
      hist('2026-02-15', -2000),
      hist('2026-03-15', -2000),
    ]);
    expect(s.suggest(row())).toBeNull();
  });
});
