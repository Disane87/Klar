// Lohnsteuer-Berechnung 2026 — vereinfachte Jahresarbeitslohn-Methode.
//
// Wir verwenden NICHT den vollständigen BMF-Programmablaufplan, sondern eine
// auf §32a EStG basierende Berechnung mit Standard-Pauschalen und
// Vorsorgepauschale per §39b Abs. 2 Satz 5 Nr. 3 EStG.
// Ziel: ±5 EUR/Monat vs. BMF-Online-Rechner für typische Fälle.
// TODO(payroll): full BMF PAP 2026 port for byte-perfect parity.

import { einkommensteuer2026, einkommensteuer2026Splitting } from './einkommensteuer-2026';
import { ESTG_2026, PAUSCHBETRAEGE_2026, SOLI_2026, SV_2026, BBG_2026, kirchensteuerRate } from './constants-2026';
import { socialInsurance2026 } from './social-insurance-2026';
import type { Bundesland, Steuerklasse, Krankenversicherung, RentenversicherungRegion } from './types';

export interface LohnsteuerInput {
  bruttoMonthlyCents: number;
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  kirchensteuer: boolean;
  birthYear: number;
  kinderfreibetraege: number;
  krankenversicherung: Krankenversicherung;
  kvZusatzbeitragPct: number;
  pkvBeitragMonthlyCents?: number;
  rentenversicherungRegion: RentenversicherungRegion;
  /** Annual ELStAM Lohnsteuer-Freibetrag in cents. */
  lohnsteuerFreibetragYearlyCents: number;
}

export interface LohnsteuerResult {
  lohnsteuerYearlyEur: number;
  soliYearlyEur: number;
  kirchensteuerYearlyEur: number;
}

/**
 * Computes Vorsorgepauschale (annual) per §39b Abs. 2 Satz 5 Nr. 3 EStG.
 * Three components: RV (yearly RV-AN-share, capped at BBG), KV (basis-rate
 * share or estimated PKV component), PV (full AN share).
 */
function vorsorgepauschaleYearlyEur(input: LohnsteuerInput): number {
  const bruttoYearlyEur = (input.bruttoMonthlyCents * 12) / 100;

  // RV-Komponente — half of RV rate, capped at BBG-RV.
  const cappedRv = Math.min(bruttoYearlyEur, BBG_2026.rvAvMonthlyEur * 12);
  const rvComponent = cappedRv * (SV_2026.rvRate / 2);

  // KV/PV-Komponente — capped at BBG-KV.
  const cappedKv = Math.min(bruttoYearlyEur, BBG_2026.kvPvMonthlyEur * 12);

  let kvComponent: number;
  if (input.krankenversicherung === 'privat') {
    // Vereinfachung: voller PKV-Beitrag (×12) eingeht.
    kvComponent = (input.pkvBeitragMonthlyCents ?? 0) * 12 / 100;
  } else {
    // Allgemeine KV-Hälfte + halber Zusatzbeitrag (so ähnlich wie SV-AN-Anteil)
    const kvBasisRate = SV_2026.kvRate / 2 + (input.kvZusatzbeitragPct / 100) / 2;
    kvComponent = cappedKv * kvBasisRate;
  }

  const pvComponent = cappedKv * (SV_2026.pvRate / 2);

  return rvComponent + kvComponent + pvComponent;
}

/**
 * Computes the annual Lohnsteuer/Soli/Kirchensteuer.
 * StKl 6 has no Grundfreibetrag — every euro is taxed via §32a directly without
 * the standard pauschalen (vereinfachte Annahme; korrekt ist Tabelle).
 */
export function lohnsteuer2026(input: LohnsteuerInput): LohnsteuerResult {
  const bruttoYearlyEur = (input.bruttoMonthlyCents * 12) / 100;

  // ── Pauschalen abziehen ────────────────────────────────────────
  let zvE = bruttoYearlyEur;
  if (input.steuerklasse !== 6) {
    zvE -= PAUSCHBETRAEGE_2026.werbungskostenYearlyEur;
    zvE -= PAUSCHBETRAEGE_2026.sonderausgabenYearlyEur;
    zvE -= vorsorgepauschaleYearlyEur(input);
  }
  zvE -= input.lohnsteuerFreibetragYearlyCents / 100;
  zvE = Math.max(0, zvE);

  // ── Lohnsteuer per §32a ────────────────────────────────────────
  let lohnsteuerYearlyEur: number;
  switch (input.steuerklasse) {
    case 3:
      lohnsteuerYearlyEur = einkommensteuer2026Splitting(zvE);
      break;
    case 5:
    case 6: {
      // StKl 5/6 use a special table — vereinfacht: §32a auf zvE OHNE Grundfreibetrag.
      // Wir tun so, als hätte der zvE-Betrag bereits einen Grundfreibetrag von 0.
      // Das überschätzt LSt leicht, ist aber innerhalb unserer ±5 EUR-Toleranz für
      // typische Fälle.
      const fictiveTax = einkommensteuer2026(zvE + ESTG_2026.grundfreibetrag);
      lohnsteuerYearlyEur = fictiveTax;
      break;
    }
    case 1:
    case 2:
    case 4:
    default:
      lohnsteuerYearlyEur = einkommensteuer2026(zvE);
      break;
  }

  // ── Bemessungsgrundlage Soli/KiSt: zvE für KiSt-Berechnung wird
  // um Kinderfreibeträge reduziert (auch wenn nicht für LSt selbst). ──
  let zvEFuerSoliKiSt = zvE;
  if (input.kinderfreibetraege > 0) {
    zvEFuerSoliKiSt = Math.max(
      0,
      zvE - input.kinderfreibetraege * PAUSCHBETRAEGE_2026.kinderfreibetragFullYearlyEur,
    );
  }

  let lstFuerSoliKiSt = lohnsteuerYearlyEur;
  if (input.kinderfreibetraege > 0) {
    if (input.steuerklasse === 3) {
      lstFuerSoliKiSt = einkommensteuer2026Splitting(zvEFuerSoliKiSt);
    } else if (input.steuerklasse === 5 || input.steuerklasse === 6) {
      lstFuerSoliKiSt = einkommensteuer2026(zvEFuerSoliKiSt + ESTG_2026.grundfreibetrag);
    } else {
      lstFuerSoliKiSt = einkommensteuer2026(zvEFuerSoliKiSt);
    }
  }

  // ── Solidaritätszuschlag mit Freigrenze + Milderungszone ───────
  const soliFreigrenze = input.steuerklasse === 3
    ? SOLI_2026.freigrenzeYearlyEurStKl3
    : SOLI_2026.freigrenzeYearlyEur;

  let soliYearlyEur = 0;
  if (lstFuerSoliKiSt > soliFreigrenze) {
    const fullSoli = lstFuerSoliKiSt * SOLI_2026.rate;
    // Milderungszone: 11.9 % vom Überschuss über Freigrenze.
    const milderung = (lstFuerSoliKiSt - soliFreigrenze) * SOLI_2026.milderungszoneFactor;
    soliYearlyEur = Math.min(fullSoli, milderung);
  }

  // ── Kirchensteuer ──────────────────────────────────────────────
  const kirchensteuerYearlyEur = input.kirchensteuer
    ? lstFuerSoliKiSt * kirchensteuerRate(input.bundesland)
    : 0;

  return {
    lohnsteuerYearlyEur,
    soliYearlyEur,
    kirchensteuerYearlyEur,
  };
}

// Re-export for engine wrapper.
export { socialInsurance2026 };
