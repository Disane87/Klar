import { describe, it, expect } from 'vitest';
import { detectFixedCosts, type FixedCostDetectionInput } from './detect-fixed-costs';

function tx(
  id: string,
  date: string,
  amountCents: number,
  counterparty: string,
  purpose = '',
): FixedCostDetectionInput {
  return { id, date, amountCents, counterparty, purpose };
}

describe('detectFixedCosts', () => {
  it('returns no candidates for empty input', () => {
    expect(detectFixedCosts([])).toEqual([]);
  });

  it('ignores groups below the minimum occurrence threshold', () => {
    // Default minOccurrences=3 → 2 txns must be filtered.
    const result = detectFixedCosts([
      tx('1', '2025-01-15', -999, 'Spotify'),
      tx('2', '2025-02-15', -999, 'Spotify'),
    ]);
    expect(result).toEqual([]);
  });

  it('detects a stable monthly subscription with high confidence', () => {
    const result = detectFixedCosts([
      tx('1', '2025-01-15', -999, 'Spotify'),
      tx('2', '2025-02-14', -999, 'Spotify'),
      tx('3', '2025-03-15', -999, 'Spotify'),
      tx('4', '2025-04-15', -999, 'Spotify'),
      tx('5', '2025-05-15', -999, 'Spotify'),
      tx('6', '2025-06-15', -999, 'Spotify'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('MONTHLY');
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.95);
    expect(result[0].amountCents).toBe(-999);
  });

  it('classifies HALF_YEARLY contracts (~182 days)', () => {
    const result = detectFixedCosts([
      tx('1', '2024-01-15', -28000, 'Provinzial Versicherung'),
      tx('2', '2024-07-15', -28000, 'Provinzial Versicherung'),
      tx('3', '2025-01-15', -28000, 'Provinzial Versicherung'),
      tx('4', '2025-07-14', -28000, 'Provinzial Versicherung'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('HALF_YEARLY');
  });

  it('classifies YEARLY when delta is ~365 days', () => {
    const result = detectFixedCosts([
      tx('1', '2023-04-01', -12000, 'ADAC'),
      tx('2', '2024-04-01', -12000, 'ADAC'),
      tx('3', '2025-04-01', -12000, 'ADAC'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('YEARLY');
  });

  it('classifies QUARTERLY (~90 days)', () => {
    const result = detectFixedCosts([
      tx('1', '2024-01-01', -5500, 'GEZ Rundfunk'),
      tx('2', '2024-04-01', -5500, 'GEZ Rundfunk'),
      tx('3', '2024-07-01', -5500, 'GEZ Rundfunk'),
      tx('4', '2024-10-01', -5500, 'GEZ Rundfunk'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('QUARTERLY');
  });

  it('falls back to CUSTOM cycle for irregular cadences', () => {
    const result = detectFixedCosts([
      tx('1', '2025-01-01', -1000, 'Stripe'),
      tx('2', '2025-01-20', -1000, 'Stripe'),
      tx('3', '2025-02-25', -1000, 'Stripe'),
      tx('4', '2025-04-10', -1000, 'Stripe'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('CUSTOM');
  });

  it('separates inflows from outflows for the same merchant key', () => {
    // PayPal has both directions — must NOT cluster together.
    const result = detectFixedCosts([
      tx('1', '2025-01-01', +1000, 'PayPal'),
      tx('2', '2025-02-01', +1000, 'PayPal'),
      tx('3', '2025-01-05', -1000, 'PayPal'),
      tx('4', '2025-02-05', -1000, 'PayPal'),
    ]);
    // Each side has only 2 txns → both filtered by minOccurrences=3
    expect(result).toEqual([]);
  });

  it('skips transactions with empty merchant key or zero amount', () => {
    const result = detectFixedCosts([
      tx('1', '2025-01-15', -999, 'Spotify'),
      tx('2', '2025-02-15', -999, 'Spotify'),
      tx('3', '2025-03-15', -999, 'Spotify'),
      tx('skip-empty', '2025-04-15', -999, ''),
      tx('skip-zero', '2025-04-15', 0, 'Spotify'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].transactionIds).toEqual(['1', '2', '3']);
  });

  it('produces deterministic alphabetical output', () => {
    const result = detectFixedCosts([
      tx('z1', '2025-01-15', -999, 'Zalando'),
      tx('z2', '2025-02-15', -999, 'Zalando'),
      tx('z3', '2025-03-15', -999, 'Zalando'),
      tx('a1', '2025-01-10', -1500, 'Amazon'),
      tx('a2', '2025-02-10', -1500, 'Amazon'),
      tx('a3', '2025-03-10', -1500, 'Amazon'),
    ]);
    expect(result.map(c => c.merchantKey)).toEqual(['amazon', 'zalando']);
  });

  it('separates Vodafone Internet and Vodafone Handy via token overlap', () => {
    // Both normalize to "vodafone" but the purpose tokens differ →
    // detector should produce TWO distinct candidates, not one merged
    // cluster with high amount-variance and low confidence.
    const result = detectFixedCosts([
      tx('i1', '2025-01-05', -3999, 'Vodafone GmbH', 'Internet Festnetz Vertrag 12345'),
      tx('i2', '2025-02-05', -3999, 'Vodafone GmbH', 'Internet Festnetz Vertrag 12345'),
      tx('i3', '2025-03-05', -3999, 'Vodafone GmbH', 'Internet Festnetz Vertrag 12345'),
      tx('h1', '2025-01-12', -2499, 'Vodafone GmbH', 'Mobilfunk Handy Vertrag 67890'),
      tx('h2', '2025-02-12', -2499, 'Vodafone GmbH', 'Mobilfunk Handy Vertrag 67890'),
      tx('h3', '2025-03-12', -2499, 'Vodafone GmbH', 'Mobilfunk Handy Vertrag 67890'),
    ]);
    expect(result).toHaveLength(2);
    const internet = result.find(c => c.amountCents === -3999);
    const handy = result.find(c => c.amountCents === -2499);
    expect(internet).toBeDefined();
    expect(handy).toBeDefined();
    // 3 stable occurrences → calibrated confidence of 0.8 (not 1.0).
    expect(internet!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(handy!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('three identical bookings yield confidence ≥ 0.65 (calibrated)', () => {
    // Old algorithm: (3-2)/4 * 0.6 + 1.0 * 0.4 = 0.55 — felt too pessimistic.
    // Calibrated: (3-1)/3 * 0.6 + 1.0 * 0.4 ≈ 0.80
    const result = detectFixedCosts([
      tx('1', '2025-01-15', -1499, 'Netflix'),
      tx('2', '2025-02-15', -1499, 'Netflix'),
      tx('3', '2025-03-15', -1499, 'Netflix'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('lowers confidence when amounts vary a lot', () => {
    const stable = detectFixedCosts([
      tx('1', '2025-01-15', -1000, 'Provider'),
      tx('2', '2025-02-15', -1000, 'Provider'),
      tx('3', '2025-03-15', -1000, 'Provider'),
      tx('4', '2025-04-15', -1000, 'Provider'),
    ]);
    const variable = detectFixedCosts([
      tx('1', '2025-01-15', -700, 'Provider'),
      tx('2', '2025-02-15', -1000, 'Provider'),
      tx('3', '2025-03-15', -1300, 'Provider'),
      tx('4', '2025-04-15', -1000, 'Provider'),
    ]);
    expect(variable[0].confidence).toBeLessThan(stable[0].confidence);
  });

  it('honours custom minConfidence and minOccurrences', () => {
    const txs = [
      tx('1', '2025-01-15', -999, 'Spotify'),
      tx('2', '2025-02-15', -999, 'Spotify'),
    ];
    expect(detectFixedCosts(txs, { minOccurrences: 2 })).toHaveLength(1);
    expect(
      detectFixedCosts(txs, { minOccurrences: 2, minConfidence: 0.99 }),
    ).toEqual([]);
  });

  it('predicts nextRenewalAt from last booking + canonical cycle days', () => {
    const result = detectFixedCosts([
      tx('1', '2025-01-15', -999, 'Spotify'),
      tx('2', '2025-02-14', -999, 'Spotify'),
      tx('3', '2025-03-15', -999, 'Spotify'),
    ]);
    expect(result[0].nextRenewalAt).toBeTruthy();
    // last seen 2025-03-15 + 30 days canonical = 2025-04-14
    expect(result[0].nextRenewalAt).toBe('2025-04-14');
  });

  it('emits source transaction ids in chronological order', () => {
    const result = detectFixedCosts([
      tx('c', '2025-03-15', -999, 'Spotify'),
      tx('a', '2025-01-15', -999, 'Spotify'),
      tx('b', '2025-02-15', -999, 'Spotify'),
    ]);
    expect(result[0].transactionIds).toEqual(['a', 'b', 'c']);
  });
});
