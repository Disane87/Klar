/**
 * FinTS Foundation (Phase 14a.2) — shared types for the import pipeline.
 *
 * Detection helpers (duplicate, fixed-cost, recurring suggester, category
 * suggester) take a minimal {@link BookingRow} shape so they don't have to
 * know whether a row originated from CSV or FinTS. The CSV parser's
 * ParsedRow structurally satisfies this shape; the future FinTS mapper
 * will produce the same shape.
 */
export interface BookingRow {
  rowIndex: number;
  date: string;
  amountCents: number;
  counterparty: string | null;
  counterpartyNorm: string;
  purpose: string | null;
  purposeNorm: string;
  externalRef: string | null;
}

/**
 * RawBooking is the shared inbound contract for the upcoming FinTS sync
 * runner and the existing CSV import. The FinTS sync runner will emit
 * RawBooking[] and call ImportPipelineService.ingest(); the CSV import
 * will follow once the interactive analyze/confirm flow is reshaped.
 *
 * Field semantics mirror the FinTS integration spec
 * (docs/superpowers/specs/2026-05-07-fints-integration-design.md §6.1).
 */
export interface RawBooking {
  /** Account-side IBAN — used to resolve the Klar Account during ingest. */
  iban: string;
  /** ISO YYYY-MM-DD (Temporal.PlainDate-compatible). */
  bookingDate: string;
  /** Wertstellung. */
  valueDate?: string;
  /** Signed: positive = income, negative = expense. */
  amountCents: number;
  /** ISO 4217 code; "EUR" by default. */
  currency: string;
  /** Full raw purpose, no truncation; SEPA subfields joined with "\n". */
  purposeRaw: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  counterpartyBic?: string;
  /** SEPA endToEndId / messageReference. */
  bankTxId?: string;
  /** FinTS GVC / SWIFT code. */
  bookingType?: string;
  /**
   * Phase 14b — set when source='fints' so detection can group standing
   * orders without re-parsing GVC codes. Derived via
   * @klar/shared#detectTransactionKind in the FinTS sync runner.
   */
  transactionKind?: import('@prisma/client').TransactionKind;
  source: 'csv' | 'fints';
  /** FintsSyncRun.id or CsvImport.id. */
  sourceRunId: string;
}
