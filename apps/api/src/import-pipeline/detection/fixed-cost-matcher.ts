import { safeDayOfMonth } from '@klar/shared';
import type { BookingRow } from '../types';

export interface RecurringForMatch {
  id: string;
  name: string;
  nameNorm: string;
  noteNorm: string;
  amountCents: number;
  isVariable: boolean;
  isActive: boolean;
  dayOfMonth: number | null;
}

const DATE_WINDOW_DAYS = 10;
const MIN_TOKEN_LENGTH = 4;

interface IndexedRecurring extends RecurringForMatch {
  tokens: string[];
}

export class FixedCostMatcher {
  private readonly indexed: IndexedRecurring[];

  constructor(recurrings: RecurringForMatch[]) {
    this.indexed = recurrings
      .filter(r => r.isActive)
      .map(r => ({ ...r, tokens: tokenize(`${r.nameNorm} ${r.noteNorm}`) }));
  }

  match(row: BookingRow): RecurringForMatch | null {
    const rowTokens = tokenize(`${row.counterpartyNorm} ${row.purposeNorm}`);
    if (rowTokens.length === 0) return null;

    const scored: Array<{ rec: IndexedRecurring; amountDiff: number; dateDiff: number }> = [];

    for (const rec of this.indexed) {
      if (!hasTokenOverlap(rec.tokens, rowTokens)) continue;
      if (!rec.isVariable && !this.amountMatches(row.amountCents, rec.amountCents)) continue;
      const dateDiff = this.dateDiff(row.date, rec.dayOfMonth);
      if (dateDiff > DATE_WINDOW_DAYS) continue;
      scored.push({
        rec,
        amountDiff: Math.abs(row.amountCents - rec.amountCents),
        dateDiff,
      });
    }

    if (scored.length === 0) return null;
    scored.sort((a, b) => a.amountDiff - b.amountDiff || a.dateDiff - b.dateDiff);
    return scored[0].rec;
  }

  private amountMatches(rowAmount: number, recAmount: number): boolean {
    const diff = Math.abs(rowAmount - recAmount);
    const tolerance = Math.max(50, Math.abs(recAmount) * 0.02);
    return diff <= tolerance;
  }

  private dateDiff(rowDate: string, dayOfMonth: number | null): number {
    if (dayOfMonth === null) return 0;
    const [y, m] = rowDate.split('-').map(Number);
    const expectedDay = safeDayOfMonth(y, m, dayOfMonth);
    const expected = new Date(Date.UTC(y, m - 1, expectedDay));
    const actual = new Date(`${rowDate}T00:00:00Z`);
    return Math.abs((actual.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
  }
}

function tokenize(s: string): string[] {
  return s
    .split(/\s+/)
    .filter(t => t.length >= MIN_TOKEN_LENGTH);
}

function hasTokenOverlap(recTokens: string[], rowTokens: string[]): boolean {
  for (const r of recTokens) {
    for (const c of rowTokens) {
      if (r === c || r.includes(c) || c.includes(r)) return true;
    }
  }
  return false;
}
