import type { BankingInformation } from 'lib-fints';

/**
 * Minimal structural shape of a BPD `allowedTransactions[]` entry.
 *
 * lib-fints models this as `BankTransaction` but doesn't re-export the
 * type from its public index. We narrow to the four fields we read so
 * the extractor stays decoupled from internal module paths.
 */
interface BpdTransactionEntry {
  transId: string;
  tanRequired: boolean;
  versions: number[];
  params?: unknown;
}

/**
 * Bank-advertised statement-fetch capabilities derived from the BPD
 * (`Bankparameterdaten`) returned during synchronise.
 *
 * Captured at connection-level (not per account) because HKKAZ/HKCAZ
 * `maxDays` is a bank-segment parameter — UPD controls which accounts
 * may use the segment, but the lookback window is global.
 *
 * Stored on `FintsConnection.capabilitiesJson` and refreshed on every
 * successful sync so a bank-side rollout of new versions (e.g. enabling
 * longer lookback) is picked up automatically.
 */
export interface FintsCapabilities {
  /** Maximum days the bank will accept as `from`-date on a statement
   *  request. `null` means the bank advertises no upper bound. */
  maxLookbackDays: number | null;
  /** Bank supports CAMT statement retrieval (HKCAZ). */
  supportsHKCAZ: boolean;
  /** Bank supports MT940 statement retrieval (HKKAZ). */
  supportsHKKAZ: boolean;
  /** Bank flagged the statement segment as TAN-pflichtig. The wizard
   *  uses this to warn the user before they pick a large range. */
  tanRequiredForStatements: boolean;
  /** ISO-8601 timestamp when these capabilities were extracted. `null`
   *  for the neutral-defaults projection returned before the first
   *  successful sync (no BPD seen yet). */
  extractedAt: string | null;
}

const HKKAZ_ID = 'HKKAZ';
const HKCAZ_ID = 'HKCAZ';

/**
 * Pure extractor — takes the {@link BankingInformation} snapshot
 * lib-fints exposes after a successful synchronise() and projects it
 * onto our slim {@link FintsCapabilities} shape.
 *
 * The bank can advertise multiple versions of the same segment (e.g.
 * HKKAZ v5 + v7). We pick the **largest** `maxDays` across versions —
 * lib-fints itself uses the newest segment version for the actual
 * request, so the most permissive limit is the relevant one.
 */
export function extractCapabilities(
  info: BankingInformation | undefined | null,
): FintsCapabilities {
  const transactions = (info?.bpd?.allowedTransactions ?? []) as readonly BpdTransactionEntry[];

  const hkkaz = pickMaxDays(transactions, HKKAZ_ID);
  const hkcaz = pickMaxDays(transactions, HKCAZ_ID);

  const maxLookbackDays = bestOf(hkcaz.maxDays, hkkaz.maxDays);
  const tanRequiredForStatements = hkcaz.tanRequired || hkkaz.tanRequired;

  return {
    maxLookbackDays,
    supportsHKCAZ: hkcaz.found,
    supportsHKKAZ: hkkaz.found,
    tanRequiredForStatements,
    extractedAt: new Date().toISOString(),
  };
}

interface SegmentSummary {
  found: boolean;
  maxDays: number | null;
  tanRequired: boolean;
}

function pickMaxDays(
  transactions: readonly BpdTransactionEntry[],
  transId: string,
): SegmentSummary {
  let found = false;
  let maxDays: number | null = null;
  let tanRequired = false;

  for (const tx of transactions) {
    if (tx.transId !== transId) continue;
    found = true;
    tanRequired = tanRequired || tx.tanRequired;
    const days = readMaxDays(tx.params);
    if (days === null) continue;
    maxDays = maxDays === null ? days : Math.max(maxDays, days);
  }

  return { found, maxDays, tanRequired };
}

function readMaxDays(params: unknown): number | null {
  if (!params || typeof params !== 'object') return null;
  const candidate = (params as { maxDays?: unknown }).maxDays;
  // The ZKA spec encodes "no limit" as `0` — surface that as `null` so
  // downstream consumers don't render "Maximaler Rückblick: 0 Tage".
  if (typeof candidate !== 'number' || candidate <= 0) return null;
  return candidate;
}

function bestOf(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}
