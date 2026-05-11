// High-level gross-to-net calculator. Aggregates the §32a tariff,
// Lohnsteuer/Soli/Kirchensteuer per §39b EStG, and the four
// Sozialversicherungs-Branchen into a NetResult.

import { lohnsteuer2026 } from './lohnsteuer-2026';
import { socialInsurance2026 } from './social-insurance-2026';
import type { GrossToNetInput, NetBreakdown, NetResult } from './types';

/**
 * Computes the German net pay from gross input using 2026 values.
 * Returns both monthly and yearly breakdowns.
 */
export function calculateNet(input: GrossToNetInput): NetResult {
  // Normalize to monthly cents.
  const bruttoMonthlyCents = input.period === 'yearly'
    ? Math.round(input.grossCents / 12)
    : input.grossCents;

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
