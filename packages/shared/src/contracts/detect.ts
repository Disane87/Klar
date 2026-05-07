// Contract detection — pure, deterministic.
// Input: transactions normalized to (date, amountCents, merchant key).
// Output: candidate contracts with cycle + confidence ∈ [0,1].
//
// Heuristik:
//   1. Group by (merchantKey, sign(amountCents)).
//   2. For each group with ≥ 3 transactions, find the dominant period
//      (median delta-in-days) and bucket-classify into MONTHLY (28..32),
//      QUARTERLY (88..95), YEARLY (358..372), or CUSTOM.
//   3. Confidence = repetition_score * 0.6 + amount_stability * 0.4
//      where repetition_score = clamp((n-2)/4, 0, 1)
//      and amount_stability = clamp(1 - rel_amount_stdev, 0, 1).
//   4. Discard candidates with confidence < 0.3.

export type ContractCycleLite = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

export interface DetectInputTransaction {
  /** Transaction id — only used for the audit trail in the candidate. */
  id: string;
  /** ISO date YYYY-MM-DD or full ISO timestamp; only the date portion is used. */
  date: string;
  /** Signed integer cents (negative = expense). */
  amountCents: number;
  /** Normalized merchant / counterparty key (lowercased, trimmed). */
  merchantKey: string;
}

export interface ContractCandidate {
  merchantKey: string;
  /** Display name = first non-empty merchantKey of the group (preserves case is caller's job). */
  name: string;
  /** Median amount across the matched group, signed cents. */
  amountCents: number;
  cycle: ContractCycleLite;
  /** Confidence score ∈ [0,1]. */
  confidence: number;
  /** ISO YYYY-MM-DD predicted next renewal (lastSeen + medianDeltaDays). */
  nextRenewalAt: string | null;
  /** Source transaction ids — audit trail. */
  transactionIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(iso: string): number {
  // Use UTC midnight to keep arithmetic deterministic across timezones.
  const ymd = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function classifyCycle(medianDays: number): ContractCycleLite {
  if (medianDays >= 28 && medianDays <= 32) return 'MONTHLY';
  if (medianDays >= 85 && medianDays <= 95) return 'QUARTERLY';
  if (medianDays >= 355 && medianDays <= 375) return 'YEARLY';
  return 'CUSTOM';
}

function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isoFromUtcMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DetectOptions {
  /** Minimum confidence to include in the result. Default 0.3. */
  minConfidence?: number;
  /** Minimum transactions per group to consider as a contract. Default 3. */
  minOccurrences?: number;
}

export function detectContracts(
  transactions: readonly DetectInputTransaction[],
  options: DetectOptions = {},
): ContractCandidate[] {
  const minConfidence = options.minConfidence ?? 0.3;
  const minOccurrences = options.minOccurrences ?? 3;

  // Group by (merchantKey, sign).
  const groups = new Map<string, DetectInputTransaction[]>();
  for (const tx of transactions) {
    if (!tx.merchantKey || tx.amountCents === 0) continue;
    const sign = tx.amountCents > 0 ? '+' : '-';
    const key = `${tx.merchantKey}|${sign}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(tx);
  }

  const candidates: ContractCandidate[] = [];

  // Iterate groups in deterministic order (alphabetical by key) so output is stable.
  const sortedKeys = [...groups.keys()].sort();
  for (const key of sortedKeys) {
    const txs = groups.get(key)!;
    if (txs.length < minOccurrences) continue;

    // Sort ascending by date.
    const sorted = [...txs].sort(
      (a, b) => parseDateOnly(a.date) - parseDateOnly(b.date),
    );

    // Compute deltas in days.
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round(
        (parseDateOnly(sorted[i].date) - parseDateOnly(sorted[i - 1].date)) /
          DAY_MS,
      );
      if (days > 0) deltas.push(days);
    }
    if (deltas.length === 0) continue;

    const medianDelta = median(deltas);
    const cycle = classifyCycle(medianDelta);

    const amounts = sorted.map(t => t.amountCents);
    const medianAmount = median(amounts);
    const amountSd = stdev(amounts);
    const relSd =
      medianAmount === 0 ? 1 : amountSd / Math.abs(medianAmount);
    const amountStability = clamp(1 - relSd, 0, 1);

    const repetitionScore = clamp((sorted.length - 2) / 4, 0, 1);
    const confidence = Number(
      (repetitionScore * 0.6 + amountStability * 0.4).toFixed(3),
    );

    if (confidence < minConfidence) continue;

    const lastSeen = parseDateOnly(sorted[sorted.length - 1].date);
    const nextRenewalAt = isoFromUtcMs(lastSeen + medianDelta * DAY_MS);

    const merchantKey = sorted[0].merchantKey;
    candidates.push({
      merchantKey,
      name: merchantKey,
      amountCents: medianAmount,
      cycle,
      confidence,
      nextRenewalAt,
      transactionIds: sorted.map(t => t.id),
    });
  }

  return candidates;
}
