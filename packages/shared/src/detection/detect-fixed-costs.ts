// Unified fixed-cost detection.
//
// One pure, deterministic algorithm consumed by every transaction-ingest path
// (CSV import, FinTS sync, manual /recompute). Replaces the previous
// `contracts/detect.ts` and supersedes the inline CSV detection that lived in
// `apps/api/src/import-pipeline/detection/recurring-suggester.ts`.
//
// Heuristic, in order:
//   1. Normalize each input to (merchantKey, sign, tokens).
//   2. Group by (merchantKey, sign) — coarse cluster.
//   3. Sub-split each cluster by TOKEN SIGNATURE (distinguishing tokens
//      that appear in some but not >50% of items). This separates Vodafone
//      Internet (purpose contains "internet"/"festnetz") from Vodafone
//      Handy (purpose contains "handy"/"mobilfunk") while keeping a single
//      Strom-Abschlag bucket together even when its amount swings ±15%
//      month over month.
//   4. Within a bucket with ≥ minOccurrences entries, take the median
//      consecutive-day-gap and classify it via FREQUENCY_WINDOWS.
//   5. Confidence = repetition_score * 0.6 + amount_stability * 0.4
//        repetition_score = clamp((n - 1) / 3, 0, 1)
//        amount_stability = clamp(1 - rel_amount_stdev, 0, 1)
//      Calibration note: the previous formula `(n-2)/4` capped 3-occurrence
//      contracts at confidence 0.55, which felt pessimistic to users — three
//      identical bookings at a clean monthly cadence ARE a fixed cost. The
//      new shape gives them ~0.80 with stable amounts, ~0.95 at four.
//   6. Discard buckets below minConfidence (default 0.3).
//   7. Predict nextRenewalAt = lastSeen + canonicalDays(cycle).

import {
  classifyByDays,
  canonicalDaysFor,
  type DetectedFrequency,
} from './frequency-windows';
import {
  combineTokens,
  normalizeMerchantKey,
} from './merchant-key';

export type FixedCostCycle = DetectedFrequency;

export interface FixedCostDetectionInput {
  /** Stable transaction id — surfaced as the audit trail. */
  id: string;
  /** ISO YYYY-MM-DD or full ISO timestamp; only the date portion is used. */
  date: string;
  /** Signed integer cents. Negative = expense, positive = income. */
  amountCents: number;
  /** Raw counterparty / merchant label. Will be normalized internally. */
  counterparty: string | null;
  /** Optional purpose / verwendungszweck. Used for token disambiguation. */
  purpose?: string | null;
}

export interface FixedCostCandidate {
  merchantKey: string;
  /** Display name — first non-empty raw counterparty in the bucket. */
  name: string;
  /** Median amount across the bucket, signed cents. */
  amountCents: number;
  cycle: FixedCostCycle;
  /** Confidence ∈ [0,1], rounded to 3 decimals for determinism. */
  confidence: number;
  /** ISO YYYY-MM-DD, or null when cycle = CUSTOM (no canonical day-gap). */
  nextRenewalAt: string | null;
  /** Source transaction ids in chronological order — audit trail. */
  transactionIds: string[];
  /** Discriminating tokens used to build this bucket. */
  tokens: string[];
}

export interface DetectFixedCostsOptions {
  /** Minimum confidence to include in the result. Default 0.3. */
  minConfidence?: number;
  /** Minimum transactions per bucket. Default 3. */
  minOccurrences?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface NormalizedInput extends FixedCostDetectionInput {
  merchantKey: string;
  sign: '+' | '-';
  tokens: string[];
}

export function detectFixedCosts(
  transactions: readonly FixedCostDetectionInput[],
  options: DetectFixedCostsOptions = {},
): FixedCostCandidate[] {
  const minConfidence = options.minConfidence ?? 0.3;
  const minOccurrences = options.minOccurrences ?? 3;

  // 1. Normalize.
  const normalized: NormalizedInput[] = [];
  for (const tx of transactions) {
    const merchantKey = normalizeMerchantKey(tx.counterparty);
    if (!merchantKey || tx.amountCents === 0) continue;
    normalized.push({
      ...tx,
      merchantKey,
      sign: tx.amountCents > 0 ? '+' : '-',
      tokens: combineTokens(tx.counterparty, tx.purpose ?? null),
    });
  }

  // 2. Coarse group by (merchantKey, sign).
  const coarse = new Map<string, NormalizedInput[]>();
  for (const item of normalized) {
    const key = `${item.merchantKey}|${item.sign}`;
    let bucket = coarse.get(key);
    if (!bucket) {
      bucket = [];
      coarse.set(key, bucket);
    }
    bucket.push(item);
  }

  // 3. Sub-split each coarse cluster by token signature so distinct services
  //    sharing the same merchant (Vodafone Internet vs. Vodafone Handy)
  //    end up in different buckets, while a single variable-amount bill
  //    (Strom-Abschlag swinging ±15%) stays together.
  const candidates: FixedCostCandidate[] = [];
  const sortedKeys = [...coarse.keys()].sort();

  for (const key of sortedKeys) {
    const cluster = coarse.get(key)!;
    const buckets = splitByTokenSignature(cluster);

    for (const bucket of buckets) {
      const candidate = buildCandidate(bucket, minOccurrences);
      if (!candidate) continue;
      if (candidate.confidence < minConfidence) continue;
      candidates.push(candidate);
    }
  }

  return candidates.sort(
    (a, b) =>
      a.merchantKey.localeCompare(b.merchantKey) ||
      a.amountCents - b.amountCents,
  );
}

/**
 * Sub-split a coarse (merchant, sign) cluster into buckets that share a
 * token signature. The signature for an item is its DISCRIMINATING tokens —
 * tokens present in some items but in no more than half of them. Tokens
 * present in more than half of items (e.g. the merchant brand itself, or
 * generic words like "vertrag") count as shared and are stripped from each
 * item's signature.
 */
function splitByTokenSignature(
  cluster: NormalizedInput[],
): NormalizedInput[][] {
  if (cluster.length < 2) return [cluster];

  const tokenCounts = new Map<string, number>();
  for (const item of cluster) {
    for (const t of item.tokens) {
      tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
    }
  }
  // Strict > 50% threshold so a 50/50 split between two services keeps each
  // half's tokens as discriminating, but a 67% common token gets folded
  // into the shared set.
  const sharedThreshold = cluster.length / 2;
  const shared = new Set<string>();
  for (const [t, count] of tokenCounts) {
    if (count > sharedThreshold) shared.add(t);
  }

  const groups = new Map<string, NormalizedInput[]>();
  for (const item of cluster) {
    const sig = item.tokens.filter(t => !shared.has(t)).sort().join('|');
    let bucket = groups.get(sig);
    if (!bucket) {
      bucket = [];
      groups.set(sig, bucket);
    }
    bucket.push(item);
  }
  return [...groups.values()];
}

function buildCandidate(
  items: NormalizedInput[],
  minOccurrences: number,
): FixedCostCandidate | null {
  if (items.length < minOccurrences) return null;

  const sorted = [...items].sort(
    (a, b) => parseDateOnly(a.date) - parseDateOnly(b.date),
  );

  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = Math.round(
      (parseDateOnly(sorted[i].date) - parseDateOnly(sorted[i - 1].date)) /
        DAY_MS,
    );
    if (days > 0) deltas.push(days);
  }
  if (deltas.length === 0) return null;

  const medianDelta = median(deltas);
  const cycle = classifyByDays(medianDelta);

  const amounts = sorted.map(t => t.amountCents);
  const medianAmount = median(amounts);
  const amountSd = stdev(amounts);
  const relSd = medianAmount === 0 ? 1 : amountSd / Math.abs(medianAmount);
  const amountStability = clamp(1 - relSd, 0, 1);

  // Calibrated repetition: 1 occurrence → 0, 4 → 1.0, 3 → 0.67.
  const repetitionScore = clamp((sorted.length - 1) / 3, 0, 1);
  const confidence = round3(repetitionScore * 0.6 + amountStability * 0.4);

  const lastSeen = parseDateOnly(sorted[sorted.length - 1].date);
  const canonical = canonicalDaysFor(cycle);
  const nextRenewalAt =
    canonical > 0 ? isoFromUtcMs(lastSeen + canonical * DAY_MS) : null;

  // Display name: first non-empty raw counterparty in chronological order.
  const displayName =
    sorted.find(s => s.counterparty && s.counterparty.trim())?.counterparty?.trim() ??
    sorted[0].merchantKey;

  return {
    merchantKey: sorted[0].merchantKey,
    name: displayName,
    amountCents: medianAmount,
    cycle,
    confidence,
    nextRenewalAt,
    transactionIds: sorted.map(t => t.id),
    tokens: items[0].tokens,
  };
}

function parseDateOnly(iso: string): number {
  const ymd = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function isoFromUtcMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
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

function round3(v: number): number {
  return Number(v.toFixed(3));
}
