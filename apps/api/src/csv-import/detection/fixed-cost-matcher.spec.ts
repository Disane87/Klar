import { describe, it, expect } from 'vitest';
import { FixedCostMatcher, type RecurringForMatch } from './fixed-cost-matcher';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  rowIndex: 0,
  date: '2026-04-01',
  amountCents: -999,
  counterparty: 'Spotify',
  counterpartyNorm: 'spotify',
  purpose: 'Spotify Premium',
  purposeNorm: 'spotify premium',
  externalRef: null,
  ...overrides,
});

const recurring = (overrides: Partial<RecurringForMatch> = {}): RecurringForMatch => ({
  id: 'rec1',
  name: 'Spotify',
  nameNorm: 'spotify',
  noteNorm: '',
  amountCents: -999,
  isVariable: false,
  isActive: true,
  dayOfMonth: 1,
  ...overrides,
});

describe('FixedCostMatcher', () => {
  it('matches when name and amount and date align', () => {
    const m = new FixedCostMatcher([recurring()]);
    expect(m.match(row())?.id).toBe('rec1');
  });

  it('honors 2% tolerance', () => {
    const m = new FixedCostMatcher([recurring({ amountCents: -1000 })]);
    expect(m.match(row({ amountCents: -999 }))).not.toBeNull();
  });

  it('honors 50 cent absolute tolerance for small amounts', () => {
    const m = new FixedCostMatcher([recurring({ amountCents: -100 })]);
    expect(m.match(row({ amountCents: -140 }))).not.toBeNull();
  });

  it('rejects amount outside tolerance', () => {
    const m = new FixedCostMatcher([recurring({ amountCents: -1000 })]);
    expect(m.match(row({ amountCents: -1500 }))).toBeNull();
  });

  it('skips inactive recurrings', () => {
    const m = new FixedCostMatcher([recurring({ isActive: false })]);
    expect(m.match(row())).toBeNull();
  });

  it('honors 5 day window', () => {
    const m = new FixedCostMatcher([recurring({ dayOfMonth: 1 })]);
    expect(m.match(row({ date: '2026-04-06' }))).not.toBeNull();
    expect(m.match(row({ date: '2026-04-07' }))).toBeNull();
  });

  it('clamps dayOfMonth via safeDayOfMonth (Feb 31 to 28/29)', () => {
    const m = new FixedCostMatcher([recurring({ dayOfMonth: 31 })]);
    expect(m.match(row({ date: '2026-02-28' }))).not.toBeNull();
  });

  it('skips amount tolerance for variable recurrings but still requires name match', () => {
    const m = new FixedCostMatcher([recurring({ isVariable: true, amountCents: -100 })]);
    expect(m.match(row({ amountCents: -50000 }))?.id).toBe('rec1');
  });

  it('matches by note substring', () => {
    const m = new FixedCostMatcher([recurring({ name: 'Streaming', nameNorm: 'streaming', noteNorm: 'spotify abo' })]);
    expect(m.match(row())?.id).toBe('rec1');
  });
});
