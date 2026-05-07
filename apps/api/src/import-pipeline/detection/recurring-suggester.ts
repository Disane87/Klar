import type { BookingRow } from '../types';

export interface HistoryEntry {
  counterpartyNorm: string;
  date: string;
  amountCents: number;
}

export type EstimatedFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface SuggestionResult {
  estimatedFrequency: EstimatedFrequency;
  pastOccurrences: number;
}

const AMOUNT_TOLERANCE_PCT = 0.05;

export class RecurringSuggester {
  private readonly byCp: Map<string, HistoryEntry[]>;

  constructor(history: HistoryEntry[]) {
    this.byCp = new Map();
    for (const e of history) {
      if (!this.byCp.has(e.counterpartyNorm)) this.byCp.set(e.counterpartyNorm, []);
      this.byCp.get(e.counterpartyNorm)!.push(e);
    }
  }

  suggest(row: BookingRow): SuggestionResult | null {
    if (!row.counterpartyNorm) return null;
    const all = this.byCp.get(row.counterpartyNorm) ?? [];
    const matches = all.filter(e => this.amountMatches(e.amountCents, row.amountCents));
    if (matches.length < 3) return null;

    const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(this.daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const freq = this.classifyFrequency(avg);
    if (!freq) return null;
    return { estimatedFrequency: freq, pastOccurrences: matches.length };
  }

  private amountMatches(a: number, b: number): boolean {
    const tolerance = Math.abs(b) * AMOUNT_TOLERANCE_PCT;
    return Math.abs(a - b) <= tolerance;
  }

  private daysBetween(a: string, b: string): number {
    const ta = new Date(`${a}T00:00:00Z`).getTime();
    const tb = new Date(`${b}T00:00:00Z`).getTime();
    return Math.abs(tb - ta) / (1000 * 60 * 60 * 24);
  }

  private classifyFrequency(avgDays: number): EstimatedFrequency | null {
    if (avgDays >= 6   && avgDays <= 8)   return 'WEEKLY';
    if (avgDays >= 25  && avgDays <= 35)  return 'MONTHLY';
    if (avgDays >= 80  && avgDays <= 100) return 'QUARTERLY';
    if (avgDays >= 170 && avgDays <= 195) return 'HALF_YEARLY';
    if (avgDays >= 350 && avgDays <= 380) return 'YEARLY';
    return null;
  }
}
