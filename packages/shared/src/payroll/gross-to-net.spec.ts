import { describe, it, expect } from 'vitest';
import { calculateNet } from './gross-to-net';
import type { GrossToNetInput } from './types';

const baseInput: GrossToNetInput = {
  grossCents: 400000, // 4000€/Monat
  period: 'monthly',
  steuerklasse: 1,
  bundesland: 'NW',
  kirchensteuer: false,
  birthYear: 1990,
  kinderfreibetraege: 0,
  krankenversicherung: 'gesetzlich',
  kvZusatzbeitragPct: 1.7,
  rentenversicherungRegion: 'west',
  geldwerterVorteilMonthlyCents: 0,
  lohnsteuerFreibetragYearlyCents: 0,
};

describe('calculateNet — sanity / invariants', () => {
  it('returns brutto = input for monthly period', () => {
    const r = calculateNet(baseInput);
    expect(r.monthly.bruttoCents).toBe(400000);
  });

  it('yearly = monthly × 12 for brutto', () => {
    const r = calculateNet(baseInput);
    expect(r.yearly.bruttoCents).toBe(r.monthly.bruttoCents * 12);
  });

  it('netto = brutto - steuern - sozialabgaben', () => {
    const r = calculateNet(baseInput);
    expect(r.monthly.nettoCents).toBe(
      r.monthly.bruttoCents - r.monthly.steuernCents - r.monthly.sozialabgabenCents,
    );
  });

  it('steuern = lohnsteuer + soli + kirchensteuer', () => {
    const r = calculateNet(baseInput);
    expect(r.monthly.steuernCents).toBe(
      r.monthly.lohnsteuerCents + r.monthly.soliCents + r.monthly.kirchensteuerCents,
    );
  });

  it('sozialabgaben = kv + pv + rv + av', () => {
    const r = calculateNet(baseInput);
    expect(r.monthly.sozialabgabenCents).toBe(
      r.monthly.kvCents + r.monthly.pvCents + r.monthly.rvCents + r.monthly.avCents,
    );
  });

  it('higher gross yields higher net (monotonicity)', () => {
    const low  = calculateNet(baseInput);
    const high = calculateNet({ ...baseInput, grossCents: 500000 });
    expect(high.monthly.nettoCents).toBeGreaterThan(low.monthly.nettoCents);
  });

  it('Soli is 0 below Freigrenze', () => {
    // 2000€/Monat → ~24k Brutto/Jahr → LSt deutlich unter 19,950€
    const r = calculateNet({ ...baseInput, grossCents: 200000 });
    expect(r.monthly.soliCents).toBe(0);
  });

  it('charges Kirchensteuer when enabled', () => {
    const without = calculateNet(baseInput);
    const withK   = calculateNet({ ...baseInput, kirchensteuer: true });
    expect(withK.monthly.kirchensteuerCents).toBeGreaterThan(0);
    expect(without.monthly.kirchensteuerCents).toBe(0);
    expect(withK.monthly.nettoCents).toBeLessThan(without.monthly.nettoCents);
  });

  it('Bayern uses 8% Kirchensteuer (lower than NRW 9%)', () => {
    const nw = calculateNet({ ...baseInput, kirchensteuer: true, bundesland: 'NW' });
    const by = calculateNet({ ...baseInput, kirchensteuer: true, bundesland: 'BY' });
    expect(by.monthly.kirchensteuerCents).toBeLessThan(nw.monthly.kirchensteuerCents);
  });

  it('StKl 3 (splitting) yields lower tax than StKl 1 at same gross', () => {
    const stkl1 = calculateNet(baseInput);
    const stkl3 = calculateNet({ ...baseInput, steuerklasse: 3 });
    expect(stkl3.monthly.lohnsteuerCents).toBeLessThan(stkl1.monthly.lohnsteuerCents);
  });

  it('StKl 6 yields highest tax', () => {
    const stkl1 = calculateNet(baseInput);
    const stkl6 = calculateNet({ ...baseInput, steuerklasse: 6 });
    expect(stkl6.monthly.lohnsteuerCents).toBeGreaterThan(stkl1.monthly.lohnsteuerCents);
  });

  it('PKV path uses entered contribution as kvCents', () => {
    const r = calculateNet({
      ...baseInput,
      krankenversicherung: 'privat',
      pkvBeitragMonthlyCents: 35000,
    });
    expect(r.monthly.kvCents).toBe(35000);
  });

  it('yearly mode divides input by 12', () => {
    const r = calculateNet({ ...baseInput, grossCents: 400000 * 12, period: 'yearly' });
    expect(r.monthly.bruttoCents).toBe(400000);
  });

  it('Kinderfreibeträge reduce Soli/KiSt but not Lohnsteuer', () => {
    const noKids = calculateNet({ ...baseInput, kirchensteuer: true, grossCents: 800000 });
    const kids   = calculateNet({ ...baseInput, kirchensteuer: true, grossCents: 800000, kinderfreibetraege: 2 });
    expect(kids.monthly.lohnsteuerCents).toBe(noKids.monthly.lohnsteuerCents);
    expect(kids.monthly.kirchensteuerCents).toBeLessThan(noKids.monthly.kirchensteuerCents);
  });

  it('plausibility: 4000€ brutto, StKl 1, NW, no church → net ~ 2500-2750€', () => {
    const r = calculateNet(baseInput);
    expect(r.monthly.nettoCents).toBeGreaterThan(245000);
    expect(r.monthly.nettoCents).toBeLessThan(280000);
  });

  it('plausibility: 6000€ brutto, StKl 3, BY, with church, 2 kids → net ~ 4000-4400€', () => {
    const r = calculateNet({
      ...baseInput,
      grossCents: 600000,
      steuerklasse: 3,
      bundesland: 'BY',
      kirchensteuer: true,
      kinderfreibetraege: 2,
    });
    expect(r.monthly.nettoCents).toBeGreaterThan(390000);
    expect(r.monthly.nettoCents).toBeLessThan(450000);
  });

  it('hits BBG-RV at very high income (RV grows sub-linearly)', () => {
    const at = calculateNet({ ...baseInput, grossCents: 800000 });   // 8000€ ≈ at BBG
    const above = calculateNet({ ...baseInput, grossCents: 1500000 }); // 15.000€
    // RV scales linearly until BBG, then flat. Verify above-BBG RV doesn't double.
    expect(above.monthly.rvCents).toBeLessThan(at.monthly.rvCents * 1.5);
  });
});
