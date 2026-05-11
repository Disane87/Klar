// German payroll constants for the 2026 tax year.
//
// Sources:
// - §32a EStG 2026 — Steuerfortentwicklungsgesetz (passed Dec 2024):
//   Grundfreibetrag 12,348 EUR, Eckwerte um Inflationsausgleich verschoben.
// - Sozialversicherungs-Rechengrößen-Verordnung 2026 (BMAS, late 2025):
//   BBG-KV/PV 5,812.50 EUR/Monat, BBG-RV/AV 8,450 EUR/Monat (bundeseinheitlich).
// - Pflegeversicherungs-Beitragssatzanpassung: PV-Satz 2026 angehoben auf 3.6 %.
// - Solidaritätszuschlag: Freigrenze 2026 angehoben auf 20,350 EUR LSt
//   (40,700 EUR im Splittingverfahren).
//
// Internal §32a zone offsets are calibrated for continuity at zone boundaries
// (zone3Offset, zone4Offset, zone5Offset are derived so that tax(zoneUpper)
// matches across both formulas). A unit test enforces continuity.
//
// When the BMF publishes the official Programmablaufplan 2026, double-check
// these constants — only numbers should change, not engine structure.

import type { Bundesland } from './types';

// ────────────────────────────────────────────────────────────────
// §32a EStG income tax tariff 2026 (yearly amounts in EUR, not cents)
// ────────────────────────────────────────────────────────────────

export const ESTG_2026 = {
  // Zone boundaries (zu versteuerndes Einkommen in EUR/year)
  grundfreibetrag:        12348, // Zone 1 upper bound
  zone2Upper:             17799,
  zone3Upper:             69798,
  zone4Upper:             277825,
  // Zone formulas — slopes unchanged from prior years; offsets recalibrated
  // for boundary continuity given the new zone boundaries.
  zone2SlopeA:            932.30,
  zone2SlopeB:            1400,
  zone3SlopeA:            176.64,
  zone3SlopeB:            2397,
  // tax_z2(zone2Upper) ≈ 1040.17  →  zone3Offset = 1040.17
  zone3Offset:            1040.17,
  zone4Rate:              0.42,
  // 0.42 * zone3Upper - tax_z3(zone3Upper) = 11035.25
  zone4Offset:            11035.25,
  zone5Rate:              0.45,
  // 0.45 * zone4Upper - tax_z4(zone4Upper) = 19370.00
  zone5Offset:            19370.00,
} as const;

// ────────────────────────────────────────────────────────────────
// Pauschalen used in Lohnsteuer (annual amounts in EUR)
// ────────────────────────────────────────────────────────────────

export const PAUSCHBETRAEGE_2026 = {
  /** Werbungskostenpauschale (Arbeitnehmer-Pauschbetrag) §9a Nr. 1 EStG. */
  werbungskostenYearlyEur:        1230,
  /** Sonderausgabenpauschbetrag §10c EStG. */
  sonderausgabenYearlyEur:        36,
  /** Kinderfreibetrag (full = beider Eltern, inkl. BEA) §32 Abs. 6 EStG —
   *  relevant für Soli/KiSt-Berechnung, nicht für die LSt selbst. */
  kinderfreibetragFullYearlyEur:  9756,
} as const;

// ────────────────────────────────────────────────────────────────
// Sozialversicherungs-Beitragssätze 2026
// All rates are TOTAL (employer + employee combined). AN-share is taken
// in social-insurance-2026.ts via halving (with PV exceptions).
// ────────────────────────────────────────────────────────────────

export const SV_2026 = {
  /** Krankenversicherung allgemeiner Beitragssatz. AN-Anteil = halbe Rate. */
  kvRate:                 0.146,
  /** Pflegeversicherung Beitragssatz 2026 (bundeseinheitlich, ex Sachsen). */
  pvRate:                 0.036,
  /** Zuschlag für Kinderlose > 23. Voll vom AN getragen. */
  pvKinderloseZuschlag:   0.006,
  /** Sachsen-Sonderregel: AN trägt 0.5 %-Punkt mehr. */
  pvAnZuschlagSachsen:    0.005,
  /** Rentenversicherung. AN-Anteil = halbe Rate. */
  rvRate:                 0.186,
  /** Arbeitslosenversicherung. AN-Anteil = halbe Rate. */
  avRate:                 0.026,
} as const;

// ────────────────────────────────────────────────────────────────
// Beitragsbemessungsgrenzen 2026 (monthly, EUR/month)
// Sozialversicherungs-Rechengrößen-Verordnung 2026.
// RV/AV bundeseinheitlich seit 2025.
// ────────────────────────────────────────────────────────────────

export const BBG_2026 = {
  /** Krankenversicherung und Pflegeversicherung. */
  kvPvMonthlyEur:         5812.50,
  /** Rentenversicherung und Arbeitslosenversicherung (bundeseinheitlich). */
  rvAvMonthlyEur:         8450,
} as const;

// ────────────────────────────────────────────────────────────────
// Solidaritätszuschlag 2026 (§§3, 4 SolzG)
// Freigrenze 2026 angehoben auf 20,350 EUR Jahres-Lohnsteuer
// (40,700 EUR bei Anwendung des Splittingverfahrens).
// ────────────────────────────────────────────────────────────────

export const SOLI_2026 = {
  /** Rate beyond the Milderungszone — 5.5 % der Lohnsteuer. */
  rate:                       0.055,
  /** Freigrenze (kein Soli unterhalb dieses LSt-Betrags), StKl 1/2/4/5/6. */
  freigrenzeYearlyEur:        20350,
  /** Verdoppelt im Splittingverfahren (StKl 3). */
  freigrenzeYearlyEurStKl3:   40700,
  /** Milderungszone: Überhang über Freigrenze * Faktor → Soli-Betrag. */
  milderungszoneFactor:       0.119,
} as const;

// ────────────────────────────────────────────────────────────────
// Kirchensteuer rates by Bundesland (8 % BY/BW, 9 % rest)
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
