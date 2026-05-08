import { Injectable, Logger } from '@nestjs/common';
import { ImportPipelineRepository } from './import-pipeline.repository';
import { rowHash } from './utils/row-hash';
import { counterpartyKey } from './utils/counterparty-key';
import type { BookingRow, RawBooking } from './types';

export interface IngestContext {
  householdId: string;
  accountId: string;
  /** User who triggered the import; null for cron-driven FinTS syncs. */
  triggeredByUserId: string | null;
  source: 'csv' | 'fints';
  /** FintsSyncRun.id when source='fints'. */
  fintsSyncRunId?: string;
  /** CsvImport.id when source='csv'. */
  sourceImportId?: string;
}

export interface IngestResult {
  imported: number;
  skipped: number;
  skippedExternalRef: number;
  skippedExternalHash: number;
}

/**
 * Shared inbound entry point for CSV imports and the FinTS sync runner
 * (Phase 14a.7-final).
 *
 * Responsibility split:
 *   - this service: dedup, hash computation, persistence
 *   - the existing csv-import.service: interactive analyze/confirm flow,
 *     fixed-cost matching, learning. CSV continues to call its own
 *     repository directly during the interactive confirm step; the
 *     FinTS sync runner uses ingest() for batch insertion.
 *
 * A future iteration can move the CSV confirm path through ingest() too,
 * but that change is decoupled from FinTS shipping and would break
 * existing CSV-import unit tests if rushed.
 */
@Injectable()
export class ImportPipelineService {
  private readonly logger = new Logger(ImportPipelineService.name);

  constructor(private readonly repo: ImportPipelineRepository) {}

  async ingest(
    bookings: RawBooking[],
    ctx: IngestContext,
  ): Promise<IngestResult> {
    if (bookings.length === 0) {
      return { imported: 0, skipped: 0, skippedExternalRef: 0, skippedExternalHash: 0 };
    }

    // 1. Existing-row dedup. We check against the same account so two
    // accounts with overlapping IBANs (rare but possible across users)
    // don't collide.
    const refs = bookings
      .map(b => b.bankTxId)
      .filter((v): v is string => !!v);
    const hashes = bookings.map(b => this.computeHash(b));

    const [existingRefs, existingHashes] = await Promise.all([
      this.repo.findExistingRefs(ctx.accountId, refs),
      this.repo.findExistingHashes(ctx.accountId, hashes),
    ]);
    const existingRefSet = new Set(existingRefs);
    const existingHashSet = new Set(existingHashes);

    let imported = 0;
    let skippedExternalRef = 0;
    let skippedExternalHash = 0;

    // 2. Pre-resolve fallback categories once per ingest — every booking
    // needs a categoryId at insert time. The learning layer (CSV path)
    // refines this; FinTS rows can be re-categorised by the user later.
    const incomeCat = await this.repo.findFallbackCategory(ctx.householdId, 'income');
    const expenseCat = await this.repo.findFallbackCategory(ctx.householdId, 'expense');
    if (!incomeCat || !expenseCat) {
      throw new Error(
        `Household ${ctx.householdId} has no usable income/expense category — cannot auto-ingest`,
      );
    }

    for (const booking of bookings) {
      const hash = this.computeHash(booking);

      if (booking.bankTxId && existingRefSet.has(booking.bankTxId)) {
        skippedExternalRef++;
        continue;
      }
      if (existingHashSet.has(hash)) {
        skippedExternalHash++;
        continue;
      }

      // Track the freshly-inserted hash so dupes within the same batch
      // skip too — banks sometimes return the same posting on the
      // overlap window.
      existingHashSet.add(hash);

      await this.repo.createTransaction({
        householdId: ctx.householdId,
        accountId: ctx.accountId,
        createdByUserId: ctx.triggeredByUserId,
        amountCents: booking.amountCents,
        categoryId: booking.amountCents >= 0 ? incomeCat : expenseCat,
        date: new Date(`${booking.bookingDate}T00:00:00Z`),
        description: booking.purposeRaw,
        counterparty: booking.counterpartyName ?? null,
        externalRef: booking.bankTxId ?? null,
        externalHash: hash,
        source: ctx.source,
        sourceImportId: ctx.sourceImportId ?? null,
        fintsSyncRunId: ctx.fintsSyncRunId ?? null,
        bankFieldsLockedAt: ctx.source === 'fints' ? new Date() : null,
        transactionKind: booking.transactionKind ?? null,
      });
      imported++;
    }

    this.logger.log(
      `Ingest ${ctx.source}: imported=${imported}, skipped(ref)=${skippedExternalRef}, skipped(hash)=${skippedExternalHash} for account ${ctx.accountId}`,
    );

    return {
      imported,
      skipped: skippedExternalRef + skippedExternalHash,
      skippedExternalRef,
      skippedExternalHash,
    };
  }

  /**
   * Computes the dedup hash. Mirrors the existing CSV path's
   * DuplicateDetector.computeHash so a CSV import and a FinTS sync of the
   * same booking land on the same hash and don't double-import.
   */
  private computeHash(booking: RawBooking): string {
    const row: Pick<BookingRow, 'date' | 'amountCents' | 'counterpartyNorm' | 'purposeNorm'> = {
      date: booking.bookingDate,
      amountCents: booking.amountCents,
      counterpartyNorm: counterpartyKey(booking.counterpartyName ?? ''),
      purposeNorm: counterpartyKey(booking.purposeRaw),
    };
    return rowHash(row);
  }
}
