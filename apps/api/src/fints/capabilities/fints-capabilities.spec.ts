import { describe, it, expect } from 'vitest';
import type { BankingInformation } from 'lib-fints';
import { extractCapabilities } from './fints-capabilities';

interface FakeTx {
  transId: string;
  tanRequired: boolean;
  versions: number[];
  params?: unknown;
}

function mkInfo(transactions: FakeTx[]): BankingInformation {
  // Only the fields the extractor reads are populated — the rest of
  // BankingInformation is irrelevant for this projection.
  return { bpd: { allowedTransactions: transactions } } as unknown as BankingInformation;
}

describe('extractCapabilities', () => {
  it('returns nullable defaults when BPD is missing', () => {
    const caps = extractCapabilities(null);
    expect(caps.maxLookbackDays).toBeNull();
    expect(caps.supportsHKCAZ).toBe(false);
    expect(caps.supportsHKKAZ).toBe(false);
    expect(caps.tanRequiredForStatements).toBe(false);
    expect(caps.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('extracts maxDays from HKKAZ when only MT940 is advertised', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKKAZ', tanRequired: false, versions: [5], params: { maxDays: 90 } as never },
      ]),
    );
    expect(caps.supportsHKKAZ).toBe(true);
    expect(caps.supportsHKCAZ).toBe(false);
    expect(caps.maxLookbackDays).toBe(90);
  });

  it('prefers the largest maxDays across multiple segment versions', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKKAZ', tanRequired: false, versions: [5], params: { maxDays: 90 } as never },
        { transId: 'HKKAZ', tanRequired: false, versions: [7], params: { maxDays: 365 } as never },
      ]),
    );
    expect(caps.maxLookbackDays).toBe(365);
  });

  it('merges HKKAZ + HKCAZ and keeps the larger lookback', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKKAZ', tanRequired: false, versions: [7], params: { maxDays: 90 } as never },
        { transId: 'HKCAZ', tanRequired: false, versions: [1], params: { maxDays: 730 } as never },
      ]),
    );
    expect(caps.supportsHKKAZ).toBe(true);
    expect(caps.supportsHKCAZ).toBe(true);
    expect(caps.maxLookbackDays).toBe(730);
  });

  it('reports tanRequired when any statement segment is flagged', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKKAZ', tanRequired: false, versions: [7], params: { maxDays: 90 } as never },
        { transId: 'HKCAZ', tanRequired: true, versions: [1], params: { maxDays: 365 } as never },
      ]),
    );
    expect(caps.tanRequiredForStatements).toBe(true);
  });

  it('treats maxDays=0 as "no limit advertised" (null)', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKKAZ', tanRequired: false, versions: [5], params: { maxDays: 0 } as never },
      ]),
    );
    expect(caps.supportsHKKAZ).toBe(true);
    expect(caps.maxLookbackDays).toBeNull();
  });

  it('ignores unrelated transaction segments', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKSPA', tanRequired: false, versions: [1], params: {} as never },
        { transId: 'HKSAL', tanRequired: true, versions: [7], params: {} as never },
      ]),
    );
    expect(caps.supportsHKKAZ).toBe(false);
    expect(caps.supportsHKCAZ).toBe(false);
    expect(caps.maxLookbackDays).toBeNull();
    expect(caps.tanRequiredForStatements).toBe(false);
  });

  it('tolerates missing params object', () => {
    const caps = extractCapabilities(
      mkInfo([
        { transId: 'HKKAZ', tanRequired: false, versions: [5], params: undefined },
      ]),
    );
    expect(caps.supportsHKKAZ).toBe(true);
    expect(caps.maxLookbackDays).toBeNull();
  });
});
