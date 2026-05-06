import type { ParsedRow } from '../parsers/sparkasse-camt-v2.parser';

export type Confidence = 'EXACT' | 'LEARNED' | 'NONE';

export interface CategorySuggestion {
  categoryId: string | null;
  confidence: Confidence;
}

export interface RecurringForCategory {
  nameNorm: string;
  categoryId: string;
}

export class CategorySuggester {
  constructor(
    private readonly recurrings: RecurringForCategory[],
    private readonly learnings: Map<string, string>,
  ) {}

  suggest(row: ParsedRow): CategorySuggestion {
    if (!row.counterpartyNorm) return { categoryId: null, confidence: 'NONE' };

    for (const rec of this.recurrings) {
      if (!rec.nameNorm) continue;
      if (
        row.counterpartyNorm.includes(rec.nameNorm) ||
        rec.nameNorm.includes(row.counterpartyNorm)
      ) {
        return { categoryId: rec.categoryId, confidence: 'EXACT' };
      }
    }

    const learned = this.learnings.get(row.counterpartyNorm);
    if (learned) return { categoryId: learned, confidence: 'LEARNED' };

    return { categoryId: null, confidence: 'NONE' };
  }
}
