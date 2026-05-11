import type { Statement, Transaction as FintsTransaction } from 'lib-fints';
import { TransactionKind } from '@prisma/client';
import { detectTransactionKind, extractBookingText } from '@klar/shared';
import type { RawBooking } from '../../import-pipeline/types';

/**
 * Maps lib-fints {@link Statement} payloads onto Klar's {@link RawBooking}
 * shape (Phase 14a.5).
 *
 * lib-fints already normalises the credit/debit indicator into the sign
 * of `amount` for both CAMT (`DBIT` → negative) and MT940 paths, so we
 * just multiply by 100 to land in our cents convention.
 *
 * The `purposeRaw` stitching mirrors what the CSV Sparkasse parser does:
 * SEPA reference fields are joined with newlines so downstream pattern
 * matchers can grep for `EREF+...`, `MREF+...` etc. without re-fetching.
 */
export interface MapBookingsContext {
  /** Klar account IBAN — lib-fints' Statement only carries the account number. */
  iban: string;
  /** Used to populate sourceRunId on each emitted RawBooking. */
  syncRunId: string;
}

export class FintsBookingMapper {
  static toRawBookings(
    statements: Statement[],
    ctx: MapBookingsContext,
  ): RawBooking[] {
    const out: RawBooking[] = [];
    for (const statement of statements) {
      const currency = statement.closingBalance?.currency ?? 'EUR';
      for (const tx of statement.transactions) {
        out.push(this.toRawBooking(tx, currency, ctx));
      }
    }
    return out;
  }

  static toRawBooking(
    tx: FintsTransaction,
    currency: string,
    ctx: MapBookingsContext,
  ): RawBooking {
    const amountCents = Math.round((tx.amount ?? 0) * 100);
    const bankTxId = tx.e2eReference || tx.customerReference || undefined;

    const purposeRaw = this.buildPurpose(tx);
    return {
      iban: ctx.iban,
      bookingDate: this.toIsoDate(tx.entryDate),
      valueDate: tx.valueDate ? this.toIsoDate(tx.valueDate) : undefined,
      amountCents,
      currency,
      purposeRaw,
      counterpartyName: emptyToUndef(tx.remoteName),
      counterpartyIban: emptyToUndef(tx.remoteAccountNumber),
      counterpartyBic: emptyToUndef(tx.remoteBankId),
      bankTxId,
      bookingType: emptyToUndef(tx.transactionCode || tx.transactionType),
      // Fallback: when lib-fints leaves bookingText empty (common for
      // Sparkasse SEPA direct-debits) the keyword often sits at the end
      // of the SVWZ purpose — extract the canonical token so the chip
      // and the bookingText filter still work.
      bookingText:
        emptyToUndef(tx.bookingText) ??
        extractBookingText(purposeRaw) ??
        undefined,
      transactionKind: detectTransactionKind({
        bookingType: tx.transactionCode || tx.transactionType,
        purposeRaw,
      }) as TransactionKind,
      source: 'fints',
      sourceRunId: ctx.syncRunId,
    };
  }

  /**
   * Builds the raw purpose blob. lib-fints' `purpose` is the primary
   * SEPA `SVWZ` block; we append referenceable fields prefixed in the
   * same SEPA shorthand so existing CSV-import detection helpers keep
   * working without bespoke FinTS-specific patterns.
   */
  private static buildPurpose(tx: FintsTransaction): string {
    const lines: string[] = [];
    if (tx.purpose) lines.push(tx.purpose);
    if (tx.e2eReference) lines.push(`EREF+${tx.e2eReference}`);
    if (tx.mandateReference) lines.push(`MREF+${tx.mandateReference}`);
    if (tx.customerReference && tx.customerReference !== tx.e2eReference) {
      lines.push(`KREF+${tx.customerReference}`);
    }
    if (tx.bookingText) lines.push(tx.bookingText);
    if (tx.additionalInformation) lines.push(tx.additionalInformation);
    return lines.join('\n');
  }

  private static toIsoDate(d: Date): string {
    // Bank dates land here as Date — slice to YYYY-MM-DD in UTC so the
    // Klar invariant (Temporal.PlainDate semantics, no timezone drift)
    // stays intact.
    return d.toISOString().slice(0, 10);
  }
}

function emptyToUndef(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}
