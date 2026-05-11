// Sozialversicherungs-Beiträge 2026 (employee share).
//
// Inputs are in cents and outputs are in cents. We compute on the monthly
// brutto, capping each branch at its own Beitragsbemessungsgrenze (BBG).
// "Brutto" here is the SV-pflichtiges Brutto — for our calculator this equals
// the user-entered monthly gross (we do not currently model special pay or
// non-SV gross components).

import { SV_2026, BBG_2026 } from './constants-2026';
import type { Bundesland, Krankenversicherung } from './types';

export interface SocialInsuranceInput {
  bruttoMonthlyCents: number;
  krankenversicherung: Krankenversicherung;
  /** Additional KV contribution percentage (e.g. 1.7 for 1.7%). */
  kvZusatzbeitragPct: number;
  pkvBeitragMonthlyCents?: number;
  /** Birth year — used to determine the PV-Kinderlosenzuschlag (>23 without children). */
  birthYear: number;
  hasChildren: boolean;
  bundesland: Bundesland;
  /** Reference year for age calculation — defaults to current year. Injectable for tests. */
  referenceYear?: number;
}

export interface SocialInsuranceShares {
  kvCents: number;
  pvCents: number;
  rvCents: number;
  avCents: number;
  /** Gross used by Vorsorgepauschale calc later — capped to KV-BBG. */
  cappedKvPvBaseMonthlyCents: number;
  /** Gross used by Vorsorgepauschale calc later — capped to RV-BBG. */
  cappedRvAvBaseMonthlyCents: number;
}

const KV_PV_BBG_CENTS = Math.round(BBG_2026.kvPvMonthlyEur * 100);
const RV_AV_BBG_CENTS = Math.round(BBG_2026.rvAvMonthlyEur * 100);

/**
 * Computes the employee share of all four Sozialversicherungs-Branchen for one
 * month. PKV branches replace KV (PV remains gesetzlich either way for our
 * purposes — PKV-PV would need separate inputs we do not currently expose).
 */
export function socialInsurance2026(input: SocialInsuranceInput): SocialInsuranceShares {
  const cappedKvPv = Math.min(input.bruttoMonthlyCents, KV_PV_BBG_CENTS);
  const cappedRvAv = Math.min(input.bruttoMonthlyCents, RV_AV_BBG_CENTS);

  // ── KV ─────────────────────────────────────────────────────────
  let kvCents: number;
  if (input.krankenversicherung === 'privat') {
    kvCents = input.pkvBeitragMonthlyCents ?? 0;
  } else {
    const kvAnRate = SV_2026.kvRate / 2 + (input.kvZusatzbeitragPct / 100) / 2;
    kvCents = Math.round(cappedKvPv * kvAnRate);
  }

  // ── PV ─────────────────────────────────────────────────────────
  // Base AN share: half of pvRate, except Sachsen where AN bears 0.5%-pt more.
  const pvAnRateBase = input.bundesland === 'SN'
    ? SV_2026.pvRate / 2 + SV_2026.pvAnZuschlagSachsen
    : SV_2026.pvRate / 2;

  // Kinderlosenzuschlag: applies to AN only, when older than 23 and no kids.
  const referenceYear = input.referenceYear ?? new Date().getFullYear();
  const age = referenceYear - input.birthYear;
  const kinderlos = !input.hasChildren && age > 23;
  const pvAnRate = pvAnRateBase + (kinderlos ? SV_2026.pvKinderloseZuschlag : 0);

  const pvCents = Math.round(cappedKvPv * pvAnRate);

  // ── RV / AV ────────────────────────────────────────────────────
  const rvCents = Math.round(cappedRvAv * (SV_2026.rvRate / 2));
  const avCents = Math.round(cappedRvAv * (SV_2026.avRate / 2));

  return {
    kvCents,
    pvCents,
    rvCents,
    avCents,
    cappedKvPvBaseMonthlyCents: cappedKvPv,
    cappedRvAvBaseMonthlyCents: cappedRvAv,
  };
}
