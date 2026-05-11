// German payroll constants — last calibrated against the official 2025
// §32a EStG tariff and 2025 Sozialversicherungs-Rechengrößen. The internal
// zone offsets in §32a are calibrated by the BMF to be continuous at zone
// boundaries; we therefore keep the published 2025 calibration here rather
// than guessing at uncalibrated 2026 values. When the BMF publishes the
// final 2026 Programmablaufplan, refresh the constants in this file —
// engine structure does not change.
//
// TODO(payroll): refresh to 2026 once BMF PAP 2026 is published.

import type { Bundesland } from './types';

// ────────────────────────────────────────────────────────────────
// §32a EStG income tax tariff (yearly amounts in EUR, not cents)
// ────────────────────────────────────────────────────────────────

export const ESTG_2026 = {
  // Zone boundaries (zu versteuerndes Einkommen in EUR/year)
  grundfreibetrag:        12096, // Zone 1 upper bound
  zone2Upper:             17443,
  zone3Upper:             68480,
  zone4Upper:             277825,
  // Slopes / offsets per §32a
  zone2SlopeA:            932.30,
  zone2SlopeB:            1400,
  zone3SlopeA:            176.64,
  zone3SlopeB:            2397,
  zone3Offset:            1015.13,
  zone4Rate:              0.42,
  zone4Offset:            10911.92,
  zone5Rate:              0.45,
  zone5Offset:            19246.67,
} as const;

// ────────────────────────────────────────────────────────────────
// Pauschalen used in Lohnsteuer (annual amounts in EUR)
// ────────────────────────────────────────────────────────────────

export const PAUSCHBETRAEGE_2026 = {
  /** Werbungskostenpauschale (Arbeitnehmer-Pauschbetrag) §9a Nr. 1 EStG. */
  werbungskostenYearlyEur:        1230,
  /** Sonderausgabenpauschbetrag §10c EStG. */
  sonderausgabenYearlyEur:        36,
  /** Kinderfreibetrag (full = both parents) §32 Abs. 6 EStG — relevant for Soli/KiSt only. */
  kinderfreibetragFullYearlyEur:  9600,
} as const;

// ────────────────────────────────────────────────────────────────
// Sozialversicherungs-Beitragssätze 2026
// All rates are TOTAL (employer + employee combined). AN-share is taken
// in social-insurance-2026.ts via halving (with PV exceptions).
// ────────────────────────────────────────────────────────────────

export const SV_2026 = {
  /** Krankenversicherung allgemeiner Beitragssatz. AN-Anteil = halbe Rate. */
  kvRate:                 0.146,
  /** Pflegeversicherung Beitragssatz (bundeseinheitlich, ex Sachsen). */
  pvRate:                 0.034,
  /** Zuschlag für Kinderlose > 23. Voll vom AN getragen. */
  pvKinderloseZuschlag:   0.006,
  /** Sachsen-Sonderregel: AN trägt 0.5%-Punkt mehr. */
  pvAnZuschlagSachsen:    0.005,
  /** Rentenversicherung. AN-Anteil = halbe Rate. */
  rvRate:                 0.186,
  /** Arbeitslosenversicherung. AN-Anteil = halbe Rate. */
  avRate:                 0.026,
} as const;

// ────────────────────────────────────────────────────────────────
// Beitragsbemessungsgrenzen 2026 (monthly, EUR/month)
// Since 2025 RV is bundeseinheitlich (West = Ost).
// ────────────────────────────────────────────────────────────────

export const BBG_2026 = {
  /** Krankenversicherung und Pflegeversicherung. */
  kvPvMonthlyEur:         5512.50,
  /** Rentenversicherung und Arbeitslosenversicherung (bundeseinheitlich seit 2025). */
  rvAvMonthlyEur:         8050,
} as const;

// ────────────────────────────────────────────────────────────────
// Solidaritätszuschlag 2026 (§§3, 4 SolzG)
// Wegfallgrenze: Soli fällt erst an, wenn die Jahres-Lohnsteuer über
// Freigrenze liegt. Darüber bis Milderungszone-Obergrenze gleitender
// Anstieg. Darüber 5.5% von LSt.
// ────────────────────────────────────────────────────────────────

export const SOLI_2026 = {
  /** Rate beyond the milderungszone — 5.5% of Lohnsteuer. */
  rate:                       0.055,
  /** Freigrenze (no Soli below this LSt amount), StKl 1/2/4/5/6. */
  freigrenzeYearlyEur:        19950,
  /** Doubled for StKl 3 (splitting). */
  freigrenzeYearlyEurStKl3:   39900,
  /** Milderungszone: tax surplus over Freigrenze is multiplied by this factor
   *  before being multiplied by the rate. Source: §4 SolzG (2026 projection). */
  milderungszoneFactor:       0.119,
} as const;

// ────────────────────────────────────────────────────────────────
// Kirchensteuer rates by Bundesland
// ────────────────────────────────────────────────────────────────

const KIRCHENSTEUER_RATES: Record<Bundesland, number> = {
  BW: 0.08, BY: 0.08,
  BE: 0.09, BB: 0.09, HB: 0.09, HH: 0.09, HE: 0.09, MV: 0.09,
  NI: 0.09, NW: 0.09, RP: 0.09, SL: 0.09, SN: 0.09, ST: 0.09,
  SH: 0.09, TH: 0.09,
};

export function kirchensteuerRate(bl: Bundesland): number {
  return KIRCHENSTEUER_RATES[bl];
}
