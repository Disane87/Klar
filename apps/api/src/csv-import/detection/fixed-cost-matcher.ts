import { safeDayOfMonth } from '@klar/shared';
import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

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

const DATE_WINDOW_DAYS = 5;

export class FixedCostMatcher {
  constructor(private readonly recurrings: RecurringForMatch[]) {}

  match(row: ParsedRow): RecurringForMatch | null {
    for (const rec of this.recurrings) {
      if (!rec.isActive) continue;
      if (!this.nameMatches(row, rec)) continue;
      if (!rec.isVariable && !this.amountMatches(row.amountCents, rec.amountCents)) continue;
      if (!this.dateMatches(row.date, rec.dayOfMonth)) continue;
      return rec;
    }
    return null;
  }

  private nameMatches(row: ParsedRow, rec: RecurringForMatch): boolean {
    const cp = row.counterpartyNorm;
    if (!cp) return false;
    if (rec.nameNorm && (cp.includes(rec.nameNorm) || rec.nameNorm.includes(cp))) return true;
    if (rec.noteNorm && rec.noteNorm.includes(cp)) return true;
    return false;
  }

  private amountMatches(rowAmount: number, recAmount: number): boolean {
    const diff = Math.abs(rowAmount - recAmount);
    const tolerance = Math.max(50, Math.abs(recAmount) * 0.02);
    return diff <= tolerance;
  }

  private dateMatches(rowDate: string, dayOfMonth: number | null): boolean {
    if (dayOfMonth === null) return true;
    const [y, m] = rowDate.split('-').map(Number);
    const expectedDay = safeDayOfMonth(y, m, dayOfMonth);
    const expected = new Date(Date.UTC(y, m - 1, expectedDay));
    const actual = new Date(`${rowDate}T00:00:00Z`);
    const diffDays = Math.abs((actual.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= DATE_WINDOW_DAYS;
  }
}
