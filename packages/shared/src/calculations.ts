export type RecurringFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM_DAYS';

export function safeDayOfMonth(year: number, month: number, day: number): number {
  // month is 1-based (1=January, 12=December).
  // new Date(year, month, 0) gives the last day of that month:
  //   e.g. new Date(2024, 2, 0) = last day of February 2024 = 29
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(day, lastDay);
}

export function toMonthlyEquivalent(
  amountCents: number,
  freq: RecurringFrequency,
): number {
  switch (freq) {
    case 'WEEKLY':      return Math.round(amountCents * 52 / 12);
    case 'MONTHLY':     return amountCents;
    case 'QUARTERLY':   return Math.round(amountCents / 3);
    case 'HALF_YEARLY': return Math.round(amountCents / 6);
    case 'YEARLY':      return Math.round(amountCents / 12);
    case 'CUSTOM_DAYS': return amountCents;
  }
}

export function sumByCents(items: { amountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns the arithmetic mean of all amountCents values, rounded to the
 * nearest integer. Returns 0 for an empty array.
 */
export function averageIncome(entries: { amountCents: number }[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => sum + e.amountCents, 0);
  return Math.round(total / entries.length);
}

/**
 * Converts an object to flat string key-value pairs suitable for use as HTTP
 * query parameters (e.g. Angular HttpParams).
 *
 * Rules:
 * - Keys whose value is null, undefined, or an empty string are skipped.
 * - Booleans become 'true' or 'false'.
 * - All other values are converted via String().
 */
export function toHttpParams(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (typeof value === 'boolean') {
      result[key] = value ? 'true' : 'false';
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

// ─── calculateMonthlyOverview ─────────────────────────────────────────────────

/** A recurring transaction entry as seen by the overview calculation. */
export interface RecurringEntry {
  amountCents: number;
  frequency: RecurringFrequency;
  /** Whether the entry is variable income (not used for income/expense split, sign determines that) */
  isVariable: boolean;
  visibility: 'PRIVATE' | 'SHARED';
  createdByUserId: string | null;
}

/** An ad-hoc transaction entry as seen by the overview calculation. */
export interface TransactionEntry {
  amountCents: number;
  visibility: 'PRIVATE' | 'SHARED';
  createdByUserId: string | null;
  /**
   * Detected kind from the FinTS booking type or purpose pattern. `TRANSFER`
   * entries — money moved between two of the user's OWN accounts — are
   * excluded from monthly income/expense totals; they cancel out at the
   * household level and would otherwise inflate both sides of the cashflow.
   * Other kinds (`STANDING_ORDER`, `DIRECT_DEBIT`, `CARD`, `FEE`, `OTHER`)
   * keep their amount-sign-based classification.
   */
  transactionKind?: string | null;
}

export interface OverviewInput {
  /** Recurring transactions active in the period — caller filters by date range */
  recurringEntries: RecurringEntry[];
  /** Ad-hoc transactions in the period */
  transactionEntries: TransactionEntry[];
  /** Used to filter out other users' PRIVATE items */
  requestingUserId: string;
}

export interface OverviewResult {
  /** Sum of monthly-equivalent income from recurring (positive amountCents) */
  recurringIncomeCents: number;
  /** Sum of monthly-equivalent expenses from recurring (negative amountCents, returned as positive) */
  recurringExpensesCents: number;
  /** Sum of positive amountCents from transactions */
  transactionIncomeCents: number;
  /** Sum of negative amountCents from transactions (returned as positive) */
  transactionExpensesCents: number;
  /** recurringIncomeCents + transactionIncomeCents */
  totalIncomeCents: number;
  /** recurringExpensesCents + transactionExpensesCents */
  totalExpensesCents: number;
  /** totalIncomeCents - totalExpensesCents (can be negative) */
  surplusCents: number;
}

/**
 * Calculates a monthly financial overview from recurring and ad-hoc entries.
 *
 * Privacy rule: PRIVATE entries that belong to another user are excluded from
 * the calculation entirely. SHARED entries and the requesting user's own
 * PRIVATE entries are always included.
 */
export function calculateMonthlyOverview(input: OverviewInput): OverviewResult {
  const { recurringEntries, transactionEntries, requestingUserId } = input;

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const isVisible = (entry: { visibility: 'PRIVATE' | 'SHARED'; createdByUserId: string | null }): boolean =>
    entry.visibility === 'SHARED' || entry.createdByUserId === requestingUserId;

  // ── Recurring ──────────────────────────────────────────────────────────────
  let recurringIncomeCents = 0;
  let recurringExpensesCents = 0;

  for (const entry of recurringEntries) {
    if (!isVisible(entry)) continue;
    const monthly = toMonthlyEquivalent(entry.amountCents, entry.frequency);
    if (monthly >= 0) {
      recurringIncomeCents += monthly;
    } else {
      recurringExpensesCents += -monthly; // store as positive
    }
  }

  // ── Transactions ───────────────────────────────────────────────────────────
  let transactionIncomeCents = 0;
  let transactionExpensesCents = 0;

  for (const entry of transactionEntries) {
    if (!isVisible(entry)) continue;
    // Own-account transfers (Sparkasse "ÜBERTRAG", VR-Bank "UMBUCHUNG",
    // or anything the booking-type classifier flagged as TRANSFER between
    // the user's own accounts) cancel out at the household level and
    // would otherwise inflate both income AND expense totals — exclude
    // them from the cashflow.
    if (entry.transactionKind === 'TRANSFER') continue;
    if (entry.amountCents >= 0) {
      transactionIncomeCents += entry.amountCents;
    } else {
      transactionExpensesCents += -entry.amountCents; // store as positive
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalIncomeCents = Math.round(recurringIncomeCents + transactionIncomeCents);
  const totalExpensesCents = Math.round(recurringExpensesCents + transactionExpensesCents);
  const surplusCents = totalIncomeCents - totalExpensesCents;

  return {
    recurringIncomeCents: Math.round(recurringIncomeCents),
    recurringExpensesCents: Math.round(recurringExpensesCents),
    transactionIncomeCents: Math.round(transactionIncomeCents),
    transactionExpensesCents: Math.round(transactionExpensesCents),
    totalIncomeCents,
    totalExpensesCents,
    surplusCents,
  };
}
