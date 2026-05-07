import type { BookingRow } from '../types';
import { rowHash } from '../utils/row-hash';

export class DuplicateDetector {
  constructor(
    private readonly existingRefs: Set<string>,
    private readonly existingHashes: Set<string>,
  ) {}

  static computeHash(row: BookingRow): string {
    return rowHash({
      date: row.date,
      amountCents: row.amountCents,
      counterpartyNorm: row.counterpartyNorm,
      purposeNorm: row.purposeNorm,
    });
  }

  isDuplicate(row: BookingRow): boolean {
    if (row.externalRef && this.existingRefs.has(row.externalRef)) return true;
    return this.existingHashes.has(DuplicateDetector.computeHash(row));
  }
}
