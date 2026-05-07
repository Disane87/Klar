import { describe, it, expect } from 'vitest';
import { detectContracts, type DetectInputTransaction } from './detect';

function tx(
  id: string,
  date: string,
  amountCents: number,
  merchantKey: string,
): DetectInputTransaction {
  return { id, date, amountCents, merchantKey };
}

describe('detectContracts', () => {
  it('returns no candidates for an empty input', () => {
    expect(detectContracts([])).toEqual([]);
  });

  it('ignores groups below the minimum occurrence threshold', () => {
    const inputs: DetectInputTransaction[] = [
      tx('a', '2026-01-01', -999, 'spotify'),
      tx('b', '2026-02-01', -999, 'spotify'),
    ];
    expect(detectContracts(inputs)).toEqual([]);
  });

  it('detects a stable monthly subscription with high confidence', () => {
    // Spotify-like, identical amount, ~30-day cadence × 6 → high confidence.
    const inputs: DetectInputTransaction[] = [
      tx('s1', '2026-01-03', -999, 'spotify'),
      tx('s2', '2026-02-02', -999, 'spotify'),
      tx('s3', '2026-03-04', -999, 'spotify'),
      tx('s4', '2026-04-03', -999, 'spotify'),
      tx('s5', '2026-05-03', -999, 'spotify'),
      tx('s6', '2026-06-02', -999, 'spotify'),
    ];
    const result = detectContracts(inputs);
    expect(result).toHaveLength(1);
    const c = result[0];
    expect(c.merchantKey).toBe('spotify');
    expect(c.cycle).toBe('MONTHLY');
    expect(c.amountCents).toBe(-999);
    expect(c.confidence).toBeGreaterThanOrEqual(0.95);
    expect(c.transactionIds).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(c.nextRenewalAt).toMatch(/^2026-07-/);
  });

  it('classifies yearly contracts when delta is ~365 days', () => {
    const inputs: DetectInputTransaction[] = [
      tx('y1', '2024-03-15', -7900, 'kfz-versicherung'),
      tx('y2', '2025-03-15', -7900, 'kfz-versicherung'),
      tx('y3', '2026-03-15', -7900, 'kfz-versicherung'),
    ];
    const result = detectContracts(inputs);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('YEARLY');
  });

  it('classifies quarterly contracts (~90 days)', () => {
    const inputs: DetectInputTransaction[] = [
      tx('q1', '2026-01-10', -2500, 'gez'),
      tx('q2', '2026-04-10', -2500, 'gez'),
      tx('q3', '2026-07-10', -2500, 'gez'),
      tx('q4', '2026-10-10', -2500, 'gez'),
    ];
    const result = detectContracts(inputs);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('QUARTERLY');
  });

  it('falls back to CUSTOM cycle for irregular cadences', () => {
    const inputs: DetectInputTransaction[] = [
      tx('c1', '2026-01-01', -1500, 'random'),
      tx('c2', '2026-01-20', -1500, 'random'),
      tx('c3', '2026-02-25', -1500, 'random'),
      tx('c4', '2026-04-10', -1500, 'random'),
    ];
    const result = detectContracts(inputs);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('CUSTOM');
  });

  it('lowers confidence when amounts vary a lot', () => {
    const stable: DetectInputTransaction[] = [
      tx('a1', '2026-01-01', -1000, 'a'),
      tx('a2', '2026-02-01', -1000, 'a'),
      tx('a3', '2026-03-01', -1000, 'a'),
    ];
    const noisy: DetectInputTransaction[] = [
      tx('b1', '2026-01-01', -1000, 'b'),
      tx('b2', '2026-02-01', -1300, 'b'),
      tx('b3', '2026-03-01', -800, 'b'),
    ];
    const stableConf = detectContracts(stable)[0].confidence;
    const noisyConf = detectContracts(noisy)[0].confidence;
    expect(stableConf).toBeGreaterThan(noisyConf);
  });

  it('separates inflows from outflows for the same merchant key', () => {
    // Income + expense to same counterparty → two distinct groups, both filtered
    // because each only has 2 entries.
    const inputs: DetectInputTransaction[] = [
      tx('p1', '2026-01-01', -1000, 'paypal'),
      tx('p2', '2026-02-01', -1000, 'paypal'),
      tx('p3', '2026-01-15', 1000, 'paypal'),
      tx('p4', '2026-02-15', 1000, 'paypal'),
    ];
    const result = detectContracts(inputs);
    expect(result).toEqual([]);
  });

  it('skips transactions with empty merchant key or zero amount', () => {
    const inputs: DetectInputTransaction[] = [
      tx('z1', '2026-01-01', 0, 'spotify'),
      tx('z2', '2026-02-01', -999, ''),
      tx('z3', '2026-03-01', -999, 'spotify'),
      tx('z4', '2026-04-01', -999, 'spotify'),
      tx('z5', '2026-05-01', -999, 'spotify'),
    ];
    const result = detectContracts(inputs);
    expect(result).toHaveLength(1);
    expect(result[0].transactionIds).toEqual(['z3', 'z4', 'z5']);
  });

  it('honours custom minConfidence and minOccurrences', () => {
    const inputs: DetectInputTransaction[] = [
      tx('a', '2026-01-01', -1000, 'gym'),
      tx('b', '2026-02-01', -1000, 'gym'),
    ];
    expect(detectContracts(inputs, { minOccurrences: 2 })).toHaveLength(1);
    expect(detectContracts(inputs, { minOccurrences: 2, minConfidence: 0.99 })).toEqual([]);
  });

  it('produces a deterministic order across runs (alphabetical by key)', () => {
    const inputs: DetectInputTransaction[] = [
      tx('z1', '2026-01-01', -100, 'zalando'),
      tx('z2', '2026-02-01', -100, 'zalando'),
      tx('z3', '2026-03-01', -100, 'zalando'),
      tx('a1', '2026-01-01', -100, 'amazon'),
      tx('a2', '2026-02-01', -100, 'amazon'),
      tx('a3', '2026-03-01', -100, 'amazon'),
    ];
    const result = detectContracts(inputs);
    expect(result.map(c => c.merchantKey)).toEqual(['amazon', 'zalando']);
  });
});
