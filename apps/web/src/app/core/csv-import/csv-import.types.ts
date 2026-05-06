export type RowStatus = 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';
export type Confidence = 'EXACT' | 'LEARNED' | 'NONE';

export interface AnalyzeRow {
  rowIndex: number;
  date: string;
  amountCents: number;
  counterparty: string | null;
  purpose: string | null;
  externalRef: string | null;
  status: RowStatus;
  matchedRecurringId?: string;
  matchedRecurring?: {
    id: string;
    name: string;
    amountCents: number;
    dayOfMonth: number | null;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'WEEKLY' | 'CUSTOM';
    note: string | null;
  };
  suggestedCategoryId?: string;
  suggestedCategoryConfidence: Confidence;
  suggestedRecurring?: {
    estimatedFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    pastOccurrences: number;
  };
}

export interface AnalyzeResponse {
  summary: {
    total: number;
    new: number;
    duplicates: number;
    fixedCostMatches: number;
    recurringSuggestions: number;
  };
  rows: AnalyzeRow[];
}

export interface ConfirmRowSelection {
  rowIndex: number;
  skip: boolean;
  skipReason?: 'duplicate' | 'fixed' | 'user';
  categoryId?: string;
  projectId?: string | null;
  visibility?: 'PRIVATE' | 'SHARED';
  createNewRecurring?: boolean;
}

export interface ConfirmResponse {
  imported: number;
  skippedDuplicates: number;
  skippedFixed: number;
  skippedByUser: number;
  createdRecurrings: number;
  csvImportId: string;
}
