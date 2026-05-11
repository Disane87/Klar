import { ApiProperty } from '@nestjs/swagger';

export class CsvAnalyzeSummaryResponse {
  @ApiProperty({ description: 'Total parsed rows in the CSV file.', example: 142 })
  total!: number;

  @ApiProperty({ description: 'Rows that look like new transactions.', example: 88 })
  new!: number;

  @ApiProperty({ description: 'Rows already present (duplicate detection by external reference).', example: 50 })
  duplicates!: number;

  @ApiProperty({ description: 'Rows matched against an existing fixed-cost recurring (will not be imported as transactions).', example: 3 })
  fixedCostMatches!: number;

  @ApiProperty({ description: 'Rows that look like the start of a new recurring (suggestion).', example: 1 })
  recurringSuggestions!: number;
}

export class CsvAnalyzeRowResponse {
  @ApiProperty({ description: 'Row index in the original CSV (0-based).', example: 17 })
  rowIndex!: number;

  @ApiProperty({ description: 'Booking date (ISO calendar date YYYY-MM-DD).', example: '2026-05-03' })
  date!: string;

  @ApiProperty({ description: 'Signed amount in cents (+ income, − expense).', example: -2499 })
  amountCents!: number;

  @ApiProperty({ description: 'Counterparty name from the CSV.', example: 'NETFLIX', nullable: true })
  counterparty!: string | null;

  @ApiProperty({ description: 'Transaction purpose / verwendungszweck.', example: 'Abo Mai 2026', nullable: true })
  purpose!: string | null;

  @ApiProperty({ description: 'Bank-side external reference (used for duplicate detection).', example: 'NWG-2026-05-03-001', nullable: true })
  externalRef!: string | null;

  @ApiProperty({
    description: 'Detection status. FIXED_COST_MATCH rows are never imported as Transactions.',
    enum: ['NEW', 'DUPLICATE', 'FIXED_COST_MATCH', 'RECURRING_SUGGESTION'],
    example: 'NEW',
  })
  status!: 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';

  @ApiProperty({
    description: 'Confidence level of the suggested category mapping.',
    enum: ['EXACT', 'LEARNED', 'NONE'],
    example: 'LEARNED',
  })
  suggestedCategoryConfidence!: 'EXACT' | 'LEARNED' | 'NONE';

  @ApiProperty({ description: 'Suggested category ID (UUID) if any.', required: false, example: 'cat_2a8d-...' })
  suggestedCategoryId?: string;

  @ApiProperty({ description: 'Matched recurring transaction ID (when status = FIXED_COST_MATCH).', required: false, example: 'rec_7f8e-...' })
  matchedRecurringId?: string;
}

export class CsvAnalyzeResponse {
  @ApiProperty({ type: () => CsvAnalyzeSummaryResponse })
  summary!: CsvAnalyzeSummaryResponse;

  @ApiProperty({ type: () => [CsvAnalyzeRowResponse] })
  rows!: CsvAnalyzeRowResponse[];
}

export class CsvConfirmResponse {
  @ApiProperty({ description: 'Number of rows persisted as new transactions.', example: 85 })
  imported!: number;

  @ApiProperty({ description: 'Rows skipped because they were duplicates.', example: 50 })
  skippedDuplicates!: number;

  @ApiProperty({ description: 'Rows skipped because they matched an existing fixed cost.', example: 3 })
  skippedFixed!: number;

  @ApiProperty({ description: 'Rows the user explicitly skipped.', example: 4 })
  skippedByUser!: number;

  @ApiProperty({ description: 'Recurring transactions auto-created from suggestions.', example: 1 })
  createdRecurrings!: number;

  @ApiProperty({ description: 'CSV import audit row ID.', example: 'imp_1c4f-9a2d-...' })
  csvImportId!: string;
}
