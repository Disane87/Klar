import { describe, it, expect } from 'vitest';
import { socialInsurance2026 } from './social-insurance-2026';
import { BBG_2026, SV_2026 } from './constants-2026';

const baseInput = {
  bruttoMonthlyCents: 400000, // 4000€/Monat
  krankenversicherung: 'gesetzlich' as const,
  kvZusatzbeitragPct: 1.7,
  birthYear: 1990,
  hasChildren: true,
  bundesland: 'NW' as const,
  referenceYear: 2026,
};

describe('socialInsurance2026', () => {
  it('computes KV AN-share for typical brutto', () => {
    const r = socialInsurance2026(baseInput);
    // KV AN = 7.3% + 0.85% (halber Zusatzbeitrag) = 8.15% von 4000€ = 326€
    expect(r.kvCents).toBe(Math.round(400000 * (0.073 + 0.0085)));
  });

  it('computes PV AN-share without Kinderlosen-Zuschlag for parent', () => {
    const r = socialInsurance2026(baseInput);
    // PV AN = 1.7% von 4000€
    expect(r.pvCents).toBe(Math.round(400000 * SV_2026.pvRate / 2));
  });

  it('adds PV-Kinderlosenzuschlag for childless adult > 23', () => {
    const r = socialInsurance2026({ ...baseInput, hasChildren: false });
    // PV AN = 1.7% + 0.6% = 2.3% von 4000€
    expect(r.pvCents).toBe(Math.round(400000 * (SV_2026.pvRate / 2 + SV_2026.pvKinderloseZuschlag)));
  });

  it('does NOT add Kinderlosenzuschlag for under-23', () => {
    const r = socialInsurance2026({
      ...baseInput,
      hasChildren: false,
      birthYear: 2010,
      referenceYear: 2026, // age 16
    });
    expect(r.pvCents).toBe(Math.round(400000 * SV_2026.pvRate / 2));
  });

  it('caps KV/PV at Beitragsbemessungsgrenze', () => {
    const veryHigh = socialInsurance2026({ ...baseInput, bruttoMonthlyCents: 1500000 }); // 15.000€
    const cap = Math.round(BBG_2026.kvPvMonthlyEur * 100);
    expect(veryHigh.cappedKvPvBaseMonthlyCents).toBe(cap);
  });

  it('caps RV/AV at Beitragsbemessungsgrenze', () => {
    const veryHigh = socialInsurance2026({ ...baseInput, bruttoMonthlyCents: 1500000 });
    const cap = Math.round(BBG_2026.rvAvMonthlyEur * 100);
    expect(veryHigh.cappedRvAvBaseMonthlyCents).toBe(cap);
  });

  it('uses PKV contribution when krankenversicherung is privat', () => {
    const r = socialInsurance2026({
      ...baseInput,
      krankenversicherung: 'privat',
      pkvBeitragMonthlyCents: 35000, // 350€
    });
    expect(r.kvCents).toBe(35000);
  });

  it('applies Sachsen rule (PV +0.5pt AN)', () => {
    const r = socialInsurance2026({ ...baseInput, bundesland: 'SN' });
    // PV AN in Sachsen = 1.7% + 0.5% = 2.2%
    expect(r.pvCents).toBe(Math.round(400000 * (SV_2026.pvRate / 2 + SV_2026.pvAnZuschlagSachsen)));
  });

  it('computes RV AN at 9.3%', () => {
    const r = socialInsurance2026(baseInput);
    expect(r.rvCents).toBe(Math.round(400000 * SV_2026.rvRate / 2));
  });

  it('computes AV AN at 1.3%', () => {
    const r = socialInsurance2026(baseInput);
    expect(r.avCents).toBe(Math.round(400000 * SV_2026.avRate / 2));
  });
});
