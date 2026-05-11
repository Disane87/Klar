// §32a EStG income tax tariff — 2026 values.
// Pure function: takes "zu versteuerndes Einkommen" (zvE) in EUR (number, not cents)
// and returns the income tax in EUR rounded down to full euros (per §32a Abs. 1).
//
// All formulas follow the published §32a EStG structure with five tariff zones.

import { ESTG_2026 as T } from './constants-2026';

/**
 * Computes Einkommensteuer per §32a EStG for a given zvE in EUR.
 * Returns tax in EUR (full euros, rounded down per German tax law).
 */
export function einkommensteuer2026(zvEEur: number): number {
  if (zvEEur <= T.grundfreibetrag) {
    return 0;
  }

  if (zvEEur <= T.zone2Upper) {
    const y = (zvEEur - T.grundfreibetrag) / 10000;
    const tax = (T.zone2SlopeA * y + T.zone2SlopeB) * y;
    return Math.floor(tax);
  }

  if (zvEEur <= T.zone3Upper) {
    const z = (zvEEur - T.zone2Upper) / 10000;
    const tax = (T.zone3SlopeA * z + T.zone3SlopeB) * z + T.zone3Offset;
    return Math.floor(tax);
  }

  if (zvEEur <= T.zone4Upper) {
    const tax = T.zone4Rate * zvEEur - T.zone4Offset;
    return Math.floor(tax);
  }

  const tax = T.zone5Rate * zvEEur - T.zone5Offset;
  return Math.floor(tax);
}

/**
 * Splitting-Tarif (StKl 3): tax(zvE / 2) * 2.
 * Used when one spouse takes StKl 3 and the other StKl 5.
 */
export function einkommensteuer2026Splitting(zvEEur: number): number {
  return einkommensteuer2026(zvEEur / 2) * 2;
}
