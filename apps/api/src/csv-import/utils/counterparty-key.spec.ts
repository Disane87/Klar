import { describe, it, expect } from 'vitest';
import { counterpartyKey } from './counterparty-key';

describe('counterpartyKey', () => {
  it('returns lowercase', () => {
    expect(counterpartyKey('REWE Markt GmbH')).toBe('rewe markt gmbh');
  });

  it('strips special characters except spaces', () => {
    expect(counterpartyKey('REWE  SAGT*DANKE.')).toBe('rewe sagt danke');
  });

  it('collapses whitespace', () => {
    expect(counterpartyKey('  Spotify   AB   ')).toBe('spotify ab');
  });

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(100);
    expect(counterpartyKey(long).length).toBe(64);
  });

  it('returns empty string for null/undefined', () => {
    expect(counterpartyKey(null)).toBe('');
    expect(counterpartyKey(undefined)).toBe('');
  });

  it('preserves umlauts as ascii equivalents', () => {
    expect(counterpartyKey('Müller & Söhne GmbH')).toBe('mueller soehne gmbh');
  });
});
