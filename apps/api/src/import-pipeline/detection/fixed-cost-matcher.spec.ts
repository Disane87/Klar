import { describe, it, expect } from 'vitest';
import { FixedCostMatcher, type RecurringForMatch } from './fixed-cost-matcher';
import type { BookingRow } from '../types';
import { counterpartyKey } from '../utils/counterparty-key';

const row = (overrides: Partial<BookingRow> = {}): BookingRow => ({
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

const realRow = (
  counterparty: string,
  purpose: string,
  amountCents: number,
  date: string,
): BookingRow => ({
  rowIndex: 0,
  date,
  amountCents,
  counterparty,
  counterpartyNorm: counterpartyKey(counterparty),
  purpose,
  purposeNorm: counterpartyKey(purpose),
  externalRef: null,
});

const realRec = (
  id: string,
  name: string,
  amountCents: number,
  dayOfMonth: number,
  note = '',
  isVariable = false,
): RecurringForMatch => ({
  id,
  name,
  nameNorm: counterpartyKey(name),
  noteNorm: counterpartyKey(note),
  amountCents,
  isVariable,
  isActive: true,
  dayOfMonth,
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

  it('honors 10 day window', () => {
    const m = new FixedCostMatcher([recurring({ dayOfMonth: 1 })]);
    expect(m.match(row({ date: '2026-04-11' }))).not.toBeNull();
    expect(m.match(row({ date: '2026-04-12' }))).toBeNull();
  });

  it('clamps dayOfMonth via safeDayOfMonth (Feb 31 to 28/29)', () => {
    const m = new FixedCostMatcher([recurring({ dayOfMonth: 31 })]);
    expect(m.match(row({ date: '2026-02-28' }))).not.toBeNull();
  });

  it('skips amount tolerance for variable recurrings but still requires name match', () => {
    const m = new FixedCostMatcher([recurring({ isVariable: true, amountCents: -100 })]);
    expect(m.match(row({ amountCents: -50000 }))?.id).toBe('rec1');
  });

  it('matches by note token overlap', () => {
    const m = new FixedCostMatcher([recurring({ name: 'Streaming', nameNorm: 'streaming', noteNorm: 'spotify abo' })]);
    expect(m.match(row())?.id).toBe('rec1');
  });

  describe('real-world Klar recurrings', () => {
    it('matches Spotify Family despite "AB" suffix in bank counterparty', () => {
      const rec = realRec('r-spotify', 'Spotify Family', -1799, 17, 'ab 14.04. nur 17,99€');
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('Spotify AB', 'Spotify Family Plan', -1799, '2026-04-17');
      expect(m.match(csv)?.id).toBe('r-spotify');
    });

    it('matches ADAC Kfz-Versicherung against ADAC AUTOVERSICHERUNG AG', () => {
      const rec = realRec('r-adac', 'ADAC Kfz-Versicherung', -4528, 2);
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('ADAC AUTOVERSICHERUNG AG', 'Kfz Beitrag', -4528, '2026-04-02');
      expect(m.match(csv)?.id).toBe('r-adac');
    });

    it('matches ERGO Zahnzusatz against ERGO Versicherung', () => {
      const rec = realRec('r-ergo', 'ERGO Zahnzusatz', -3780, 2);
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('ERGO Versicherung AG', 'Zahnzusatz Beitrag', -3780, '2026-04-02');
      expect(m.match(csv)?.id).toBe('r-ergo');
    });

    it('matches Hetzner Server against Hetzner Online GmbH', () => {
      const rec = realRec('r-hetzner', 'Hetzner Server', -772, 9);
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('Hetzner Online GmbH', 'Server Hosting', -772, '2026-04-09');
      expect(m.match(csv)?.id).toBe('r-hetzner');
    });

    it('matches OpenAI ChatGPT against OpenAI LLC', () => {
      const rec = realRec('r-openai', 'OpenAI ChatGPT', -2037, 13);
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('OpenAI LLC', 'ChatGPT Plus subscription', -2037, '2026-04-13');
      expect(m.match(csv)?.id).toBe('r-openai');
    });

    it('matches Provinzial Leben (quarterly) against PROVINZIAL VERSICHERUNG', () => {
      const rec = realRec('r-prov', 'Provinzial Leben', -2475, 2, 'quartalsweise');
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('PROVINZIAL VERSICHERUNG', 'Lebensversicherung Q2', -2475, '2026-04-02');
      expect(m.match(csv)?.id).toBe('r-prov');
    });

    it('disambiguates Vodafone Internet vs Vodafone Handy by amount', () => {
      const internet = realRec('r-vf-internet', 'Vodafone Internet', -4498, 18);
      const handy = realRec('r-vf-handy', 'Vodafone Handy (inkl. Netflix)', -3699, 4);
      const m = new FixedCostMatcher([internet, handy]);

      const internetRow = realRow('Vodafone GmbH', 'DSL Anschluss', -4498, '2026-04-18');
      expect(m.match(internetRow)?.id).toBe('r-vf-internet');

      const handyRow = realRow('Vodafone GmbH', 'Mobilfunk', -3699, '2026-04-04');
      expect(m.match(handyRow)?.id).toBe('r-vf-handy');
    });

    it('disambiguates Darlehen Haus 1 vs Haus 2 by amount', () => {
      const haus1 = realRec('r-d1', 'Darlehen Haus 1 (Sparkasse Kredit)', -16229, 30);
      const haus2 = realRec('r-d2', 'Darlehen Haus 2 (Sparkasse Kredit)', -4792, 30);
      const m = new FixedCostMatcher([haus1, haus2]);

      const csv1 = realRow('Sparkasse Musterstadt', 'Darlehensrate', -16229, '2026-04-30');
      expect(m.match(csv1)?.id).toBe('r-d1');

      const csv2 = realRow('Sparkasse Musterstadt', 'Darlehensrate', -4792, '2026-04-30');
      expect(m.match(csv2)?.id).toBe('r-d2');
    });

    it('matches by purpose tokens when counterparty has no direct overlap', () => {
      const rec = realRec('r-konto', 'Kontoführungsgebühren', -3000, 1, 'quartalsweise ~30€');
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('Sparkasse Musterstadt', 'Kontoführung Q1/2026', -3000, '2026-04-01');
      expect(m.match(csv)?.id).toBe('r-konto');
    });

    it('matches via Natalie token for shared payments', () => {
      const rec = realRec('r-hausrat', 'Hausrat/Strom/Gas/Wasser (via Natalie)', -29897, 2);
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('Natalie Mustermann', 'Anteil Nebenkosten', -29897, '2026-04-02');
      expect(m.match(csv)?.id).toBe('r-hausrat');
    });

    it('does not match unrelated counterparties', () => {
      const rec = realRec('r-spotify', 'Spotify Family', -1799, 17);
      const m = new FixedCostMatcher([rec]);
      const csv = realRow('Edeka Markt', 'Wocheneinkauf', -4523, '2026-04-15');
      expect(m.match(csv)).toBeNull();
    });
  });
});
