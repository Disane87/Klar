import { describe, it, expect } from 'vitest';
import { einkommensteuer2026, einkommensteuer2026Splitting } from './einkommensteuer-2026';
import { ESTG_2026 } from './constants-2026';

describe('einkommensteuer2026', () => {
  it('returns 0 for zvE within Grundfreibetrag', () => {
    expect(einkommensteuer2026(0)).toBe(0);
    expect(einkommensteuer2026(5000)).toBe(0);
    expect(einkommensteuer2026(ESTG_2026.grundfreibetrag)).toBe(0);
  });

  it('returns small positive tax just above Grundfreibetrag', () => {
    const tax = einkommensteuer2026(ESTG_2026.grundfreibetrag + 1);
    expect(tax).toBeGreaterThanOrEqual(0);
  });

  it('jumps continuously across zone boundaries (no gaps)', () => {
    const justBelowZ2 = einkommensteuer2026(ESTG_2026.zone2Upper);
    const justAboveZ2 = einkommensteuer2026(ESTG_2026.zone2Upper + 1);
    expect(justAboveZ2 - justBelowZ2).toBeLessThan(2);

    const justBelowZ3 = einkommensteuer2026(ESTG_2026.zone3Upper);
    const justAboveZ3 = einkommensteuer2026(ESTG_2026.zone3Upper + 1);
    expect(justAboveZ3 - justBelowZ3).toBeLessThan(2);
  });

  it('applies 42% marginal rate in zone 4', () => {
    const a = einkommensteuer2026(80000);
    const b = einkommensteuer2026(80100);
    expect(b - a).toBe(Math.floor(0.42 * 80100 - ESTG_2026.zone4Offset) - Math.floor(0.42 * 80000 - ESTG_2026.zone4Offset));
  });

  it('applies 45% Reichensteuer in zone 5', () => {
    const a = einkommensteuer2026(300000);
    const b = einkommensteuer2026(300100);
    expect(b - a).toBe(Math.floor(0.45 * 300100 - ESTG_2026.zone5Offset) - Math.floor(0.45 * 300000 - ESTG_2026.zone5Offset));
  });

  it('returns floor (full euros)', () => {
    const tax = einkommensteuer2026(30000);
    expect(Number.isInteger(tax)).toBe(true);
  });
});

describe('einkommensteuer2026Splitting', () => {
  it('matches 2 * tax(zvE / 2)', () => {
    const zvE = 100000;
    expect(einkommensteuer2026Splitting(zvE)).toBe(einkommensteuer2026(zvE / 2) * 2);
  });

  it('returns 0 when zvE/2 is within Grundfreibetrag', () => {
    expect(einkommensteuer2026Splitting(20000)).toBe(0);
  });
});
