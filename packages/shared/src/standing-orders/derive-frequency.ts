// Standing-order frequency derivation.
//
// Thin wrapper over the unified detection windows in
// `packages/shared/src/detection/frequency-windows.ts`. The standing-order
// flavor adds 'UNKNOWN' for the < 2-dates case (a single observed booking
// can't tell us anything about cadence) and uses strict mode where every gap
// must fit the same window — the bank tells us this is a standing order, so
// any outlier means the cadence is irregular, not that we should pick the
// dominant cycle.

import { allGapsFitWindow } from '../detection/frequency-windows';

export type DerivedFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM'
  | 'UNKNOWN';

/**
 * Infers the cadence of a recurring booking from a list of ISO dates.
 * Returns the first window whose [minDays, maxDays] tolerance contains
 * EVERY consecutive gap. Falls back to CUSTOM when gaps mix incompatibly,
 * and UNKNOWN when fewer than 2 dates are supplied.
 */
export function deriveFrequency(isoDates: readonly string[]): DerivedFrequency {
  if (isoDates.length < 2) return 'UNKNOWN';

  const sorted = [...isoDates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  return allGapsFitWindow(gaps);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.UTC(
    Number(aIso.slice(0, 4)),
    Number(aIso.slice(5, 7)) - 1,
    Number(aIso.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(bIso.slice(0, 4)),
    Number(bIso.slice(5, 7)) - 1,
    Number(bIso.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}
