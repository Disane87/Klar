// High-level gross-to-net calculator. Aggregates the §32a tariff,
// Lohnsteuer/Soli/Kirchensteuer per §39b EStG, and the four
// Sozialversicherungs-Branchen into a NetResult.

import { lohnsteuer2026 } from './lohnsteuer-2026';
import { socialInsurance2026 } from './social-insurance-2026';
import type { GrossToNetInput, NetBreakdown, NetResult, PayrollPosition } from './types';

/**
 * Sums all position amounts. Returns 0 for empty/missing list.
 * Sign-preserving — supports negative line items (e.g. corrections).
 */
export function sumPositions(positions: PayrollPosition[] | undefined): number {
  if (!positions || positions.length === 0) return 0;
  return positions.reduce((s, p) => s + p.amountCents, 0);
}

/** Effective gross used by the engine: positions sum if any, else grossCents. */
export function effectiveGrossCents(input: GrossToNetInput): number {
  if (input.positions && input.positions.length > 0) {
    return sumPositions(input.positions);
  }
  return input.grossCents;
}

/**
 * Computes the German net pay from gross input using 2026 values.
 * Returns both monthly and yearly breakdowns.
 */
export function calculateNet(input: GrossToNetInput): NetResult {
  // Effective gross: sum of positions if provided, else grossCents.
  const rawGrossCents = effectiveGrossCents(input);

  // Normalize to monthly cents.
  const bruttoMonthlyCents = input.period === 'yearly'
    ? Math.round(rawGrossCents / 12)
    : rawGrossCents;

  // Add geldwerter Vorteil to the taxable/SV-relevant gross.
  const taxableMonthlyCents = bruttoMonthlyCents + input.geldwerterVorteilMonthlyCents;

  // ── Lohnsteuer (annual EUR) ────────────────────────────────────
  const ls = lohnsteuer2026({
    bruttoMonthlyCents:               taxableMonthlyCents,
    steuerklasse:                     input.steuerklasse,
    bundesland:                       input.bundesland,
    kirchensteuer:                    input.kirchensteuer,
    birthYear:                        input.birthYear,
    kinderfreibetraege:               input.kinderfreibetraege,
    krankenversicherung:              input.krankenversicherung,
    kvZusatzbeitragPct:               input.kvZusatzbeitragPct,
    pkvBeitragMonthlyCents:           input.pkvBeitragMonthlyCents,
    rentenversicherungRegion:         input.rentenversicherungRegion,
    lohnsteuerFreibetragYearlyCents:  input.lohnsteuerFreibetragYearlyCents,
  });

  // ── Sozialversicherung (monthly cents) ─────────────────────────
  const sv = socialInsurance2026({
    bruttoMonthlyCents:   taxableMonthlyCents,
    krankenversicherung:  input.krankenversicherung,
    kvZusatzbeitragPct:   input.kvZusatzbeitragPct,
    pkvBeitragMonthlyCents: input.pkvBeitragMonthlyCents,
    birthYear:            input.birthYear,
    hasChildren:          input.kinderfreibetraege > 0,
    bundesland:           input.bundesland,
  });

  // ── Build monthly breakdown ────────────────────────────────────
  const lohnsteuerMonthlyCents     = Math.round(ls.lohnsteuerYearlyEur * 100 / 12);
  const soliMonthlyCents           = Math.round(ls.soliYearlyEur * 100 / 12);
  const kirchensteuerMonthlyCents  = Math.round(ls.kirchensteuerYearlyEur * 100 / 12);

  const steuernMonthlyCents        = lohnsteuerMonthlyCents + soliMonthlyCents + kirchensteuerMonthlyCents;
  const sozialabgabenMonthlyCents  = sv.kvCents + sv.pvCents + sv.rvCents + sv.avCents;

  // Net = brutto (without geldw. Vorteil since it's not actually paid out)
  // − taxes − sozialabgaben.
  // Geldwerter Vorteil increases tax/SV burden but isn't paid in cash.
  const nettoMonthlyCents = bruttoMonthlyCents
    - input.geldwerterVorteilMonthlyCents
    - steuernMonthlyCents
    - sozialabgabenMonthlyCents;

  const monthly: NetBreakdown = {
    bruttoCents:        bruttoMonthlyCents,
    lohnsteuerCents:    lohnsteuerMonthlyCents,
    soliCents:          soliMonthlyCents,
    kirchensteuerCents: kirchensteuerMonthlyCents,
    kvCents:            sv.kvCents,
    pvCents:            sv.pvCents,
    rvCents:            sv.rvCents,
    avCents:            sv.avCents,
    steuernCents:       steuernMonthlyCents,
    sozialabgabenCents: sozialabgabenMonthlyCents,
    nettoCents:         nettoMonthlyCents,
  };

  const yearly: NetBreakdown = {
    bruttoCents:        bruttoMonthlyCents * 12,
    lohnsteuerCents:    Math.round(ls.lohnsteuerYearlyEur * 100),
    soliCents:          Math.round(ls.soliYearlyEur * 100),
    kirchensteuerCents: Math.round(ls.kirchensteuerYearlyEur * 100),
    kvCents:            sv.kvCents * 12,
    pvCents:            sv.pvCents * 12,
    rvCents:            sv.rvCents * 12,
    avCents:            sv.avCents * 12,
    steuernCents:       steuernMonthlyCents * 12,
    sozialabgabenCents: sozialabgabenMonthlyCents * 12,
    nettoCents:         nettoMonthlyCents * 12,
  };

  return { monthly, yearly };
}

export interface PositionNetSplit {
  /** Original position from the input. */
  position: PayrollPosition;
  /** Position's share of the monthly NET, in cents. Sum equals total monthly net. */
  nettoMonthlyCents: number;
}

/**
 * Splits the total monthly net proportionally to each position's brutto share.
 *
 * Tax and Sozialabgaben are non-linear in the gross — there is no clean
 * "tax on this position alone". The pragmatic approach used here is to pro-rate
 * the total net by each position's share of the total brutto. Rounding
 * residual is added to the largest position so the sum equals the total.
 *
 * Returns an empty array when there are no positions.
 */
export function splitNetByPositions(input: GrossToNetInput, result: NetResult): PositionNetSplit[] {
  const positions = input.positions ?? [];
  if (positions.length === 0) return [];

  const totalGross = sumPositions(positions);
  const totalNet   = result.monthly.nettoCents;
  if (totalGross === 0) {
    return positions.map(p => ({ position: p, nettoMonthlyCents: 0 }));
  }

  const splits: PositionNetSplit[] = positions.map(p => ({
    position:           p,
    nettoMonthlyCents:  Math.round((p.amountCents / totalGross) * totalNet),
  }));

  // Distribute rounding residual onto the largest-by-abs-value position so the
  // sum exactly matches totalNet.
  const sum = splits.reduce((s, x) => s + x.nettoMonthlyCents, 0);
  const residual = totalNet - sum;
  if (residual !== 0 && splits.length > 0) {
    let largest = 0;
    let largestAbs = Math.abs(splits[0].nettoMonthlyCents);
    for (let i = 1; i < splits.length; i++) {
      const a = Math.abs(splits[i].nettoMonthlyCents);
      if (a > largestAbs) { largestAbs = a; largest = i; }
    }
    splits[largest] = {
      ...splits[largest],
      nettoMonthlyCents: splits[largest].nettoMonthlyCents + residual,
    };
  }

  return splits;
}

