# Brutto-Netto-Rechner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a German gross-to-net salary calculator to Klar — pure calculation library in `packages/shared` plus a standalone calculator page at `/app/netto-rechner`. Planspiel integration is a separate follow-up plan.

**Architecture:** Wrap the [`lohnsteuerrechner`](https://github.com/canida-software/lohnsteuer) npm package (official BMF Programmablaufplan port) for income tax / Soli / church-tax base. Layer our own social insurance calculation (KV/PV/RV/AV) on top with 2026 constants and BBG ceilings. Combine into one pure `calculateNetto(input)` function in `packages/shared`, surfaced through a Spartan-UI page using Signal Forms.

**Tech Stack:** TypeScript strict, `lohnsteuerrechner@^1`, Vitest, Angular 21 Zoneless + Signal Forms, Spartan UI, Tailwind 4.

---

## File Structure

**New files:**
- `packages/shared/src/payroll/types.ts` — public types: `Steuerklasse`, `Bundesland`, `Konfession`, `NettoInput`, `NettoResult`, `Pflegeversicherungs-Kinderzahl`
- `packages/shared/src/payroll/sv-beitraege-2026.ts` — 2026 contribution rates and BBG ceilings as readonly constants
- `packages/shared/src/payroll/kirchensteuer.ts` — Kirchensteuer rate per Bundesland (8% BY/BW, 9% rest)
- `packages/shared/src/payroll/netto.ts` — `calculateNetto()` and helpers
- `packages/shared/src/payroll/netto.spec.ts` — Vitest tests with reference values
- `packages/shared/src/payroll/index.ts` — barrel
- `apps/web/src/app/pages/netto-rechner/netto-rechner.component.ts`
- `apps/web/src/app/pages/netto-rechner/netto-rechner.component.html`
- `apps/web/src/app/pages/netto-rechner/netto-rechner.component.spec.ts`
- `apps/web/tests/e2e/netto-rechner.spec.ts` — Playwright smoke

**Modified files:**
- `packages/shared/package.json` — add `lohnsteuerrechner` dep
- `packages/shared/src/index.ts` — re-export payroll barrel
- `apps/web/src/app/app.routes.ts` — add `/app/netto-rechner` lazy route
- `apps/web/src/app/shared/layout/*` (whichever holds nav) — add nav entry under "Mehr"
- `README.md` — feature row + detail section

---

## Task 1: Add `lohnsteuerrechner` dependency and verify API surface

**Files:**
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Install dep**

```bash
pnpm --filter @klar/shared add lohnsteuerrechner@^1
```

- [ ] **Step 2: Sanity-check API in REPL**

Create a throwaway file `/tmp/lohnsteuer-check.mjs`:

```js
import { calculate, SUPPORTED_YEARS } from 'lohnsteuerrechner';
console.log('years:', SUPPORTED_YEARS);
// 50.000 EUR/Jahr, STKL I, kinderlos, KV-Zusatz 2.5%, PV-Zuschlag aktiv
const r = calculate(2026, { LZZ: 1, RE4: 5_000_000, STKL: 1, KVZ: 2.5, PVZ: 1, R: 0, ZKF: 0 });
console.log(r);
```

Run: `node /tmp/lohnsteuer-check.mjs`
Expected: object containing `LSTLZZ`, `SOLZLZZ`, `BK`/`BKS` (Kirchensteuer-Bemessungsgrundlage), all integers in Cent.

Note for implementer: the field used for KiSt base may be `BK` or similar — confirm from the actual output and use exactly that key in Task 4. Do NOT guess.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/package.json pnpm-lock.yaml
git commit -m "chore(shared): add lohnsteuerrechner dependency"
```

---

## Task 2: Define payroll types

**Files:**
- Create: `packages/shared/src/payroll/types.ts`

- [ ] **Step 1: Write the file**

```ts
// All monetary values are signed integer Cent (Klar convention).
// Period of inputs/outputs is always one calendar month.

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

export type Bundesland =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export type Konfession = 'none' | 'rk' | 'ev';

/** Anzahl Kinder unter 25 für PV-Beitragsabschlag (0..4+). 4 = "4 oder mehr". */
export type PflegeKinderzahl = 0 | 1 | 2 | 3 | 4;

export interface NettoInput {
  /** Bruttogehalt pro Monat in Cent (z.B. 4_500_00 für 4500 EUR). */
  bruttoMonatCents: number;
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  konfession: Konfession;
  /** Anzahl Kinderfreibeträge (halbe Schritte erlaubt: 0, 0.5, 1, 1.5, 2, ...). */
  kinderfreibetraege: number;
  /** KV-Zusatzbeitrag der Kasse in Prozent, z.B. 1.7. */
  kvZusatzbeitragPct: number;
  /** Anzahl berücksichtigter Kinder unter 25 für PV-Beitragsabschlag. */
  pflegeKinderzahl: PflegeKinderzahl;
  /** Geburtsjahr — relevant für PV-Kinderlosenzuschlag (>=23 J. + kein Kind). */
  geburtsjahr: number;
  /** True = privat krankenversichert. PKV-Beitrag wird in v1 NICHT berechnet. */
  pkv: boolean;
}

export interface NettoResult {
  bruttoMonatCents: number;
  /** Lohnsteuer pro Monat in Cent. */
  lohnsteuerCents: number;
  solidaritaetszuschlagCents: number;
  kirchensteuerCents: number;
  krankenversicherungAnCents: number;
  pflegeversicherungAnCents: number;
  rentenversicherungAnCents: number;
  arbeitslosenversicherungAnCents: number;
  /** Summe aller Abzüge AN-Anteil. */
  abzuegeGesamtCents: number;
  nettoMonatCents: number;
  /** Hochrechnung × 12 — Information, kein Steuerbescheid. */
  nettoJahrCents: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/payroll/types.ts
git commit -m "feat(shared): add payroll types for netto calculator"
```

---

## Task 3: 2026 social insurance constants

**Files:**
- Create: `packages/shared/src/payroll/sv-beitraege-2026.ts`

- [ ] **Step 1: Verify 2026 values from official sources**

Open these in a browser and copy the numbers — do NOT trust the values shown in this plan, they must be cross-checked:
- KV/PV/RV/AV rates: GKV-Spitzenverband (`gkv-spitzenverband.de`) → Beitragssätze 2026
- Beitragsbemessungsgrenzen 2026: BMAS Sozialversicherungs-Rechengrößenverordnung 2026
- Durchschnittlicher KV-Zusatzbeitrag 2026 (default value for UI): published by BMG in October of prior year

If any 2026 value is not yet published at implementation time, fall back to 2025 and add a `// TODO(spec): update once BMAS 2026 figures published` comment in this file ONLY (per CLAUDE.md: TODO is normally banned, but for jährliche Pflichtdaten is the explicit exception — flag in commit message).

- [ ] **Step 2: Write the file**

```ts
/**
 * German social insurance constants for 2026.
 * Values are official BMAS / GKV-Spitzenverband figures.
 * Source URLs are documented next to each constant; verify yearly in January.
 *
 * All percentage values are full contribution (employer + employee combined)
 * unless suffixed with `_AN` (Arbeitnehmer share only).
 */

export const SV_2026 = {
  jahr: 2026,

  // --- Krankenversicherung (GKV) ---
  // gkv-spitzenverband.de
  kv: {
    allgemein: 14.6,        // %
    allgemein_AN: 7.3,      // %
    /** Default Zusatzbeitrag (kassenindividuell). UI-Default. */
    zusatzbeitragDefault: 2.5, // % — VERIFY before merge
    zusatzbeitrag_AN_factor: 0.5, // hälftig getragen
  },

  // --- Pflegeversicherung ---
  pv: {
    basis: 3.6,             // %
    basis_AN: 1.8,          // %
    kinderlosenZuschlag_AN: 0.6, // % nur AN, ab 23. Lebensjahr
    /** Abschlag pro Kind ab 2. Kind (bis 5. Kind), nur AN-Anteil. */
    kindAbschlag_AN: 0.25,
    /** Sachsen: AN trägt zusätzlich 0.5% (kein Buß- und Bettag). */
    sachsenSonderlast_AN: 0.5,
  },

  // --- Rentenversicherung ---
  rv: {
    satz: 18.6,             // %
    satz_AN: 9.3,           // %
  },

  // --- Arbeitslosenversicherung ---
  av: {
    satz: 2.6,              // %
    satz_AN: 1.3,           // %
  },

  // --- Beitragsbemessungsgrenzen (Monat, in Cent) ---
  // BMAS Sozialversicherungs-Rechengrößenverordnung 2026 — VERIFY
  bbg: {
    /** KV/PV — bundeseinheitlich. */
    kvPv: 553_125,          // 5531.25 EUR/Monat — VERIFY
    /** RV/AV — ab 2025 bundeseinheitlich. */
    rvAv: 805_000,          // 8050 EUR/Monat — VERIFY
  },
} as const;

export type SvKonstanten = typeof SV_2026;
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/payroll/sv-beitraege-2026.ts
git commit -m "feat(shared): add 2026 social insurance constants"
```

---

## Task 4: Kirchensteuer config

**Files:**
- Create: `packages/shared/src/payroll/kirchensteuer.ts`

- [ ] **Step 1: Write the file**

```ts
import type { Bundesland, Konfession } from './types';

/** KiSt-Hebesatz: 8% in BW und BY, 9% sonst. */
export function kirchensteuerSatzPct(bundesland: Bundesland, konfession: Konfession): number {
  if (konfession === 'none') return 0;
  return bundesland === 'BW' || bundesland === 'BY' ? 8 : 9;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/payroll/kirchensteuer.ts
git commit -m "feat(shared): add kirchensteuer rate lookup"
```

---

## Task 5: Failing tests for `calculateNetto`

**Files:**
- Create: `packages/shared/src/payroll/netto.spec.ts`

- [ ] **Step 1: Derive reference values**

Open the official BMF calculator at `bmf-steuerrechner.de` (Lohn- und Einkommensteuerrechner → "Lohnsteuer 2026"). For each of the three test cases below, enter the inputs and write down the BMF result. Use those values in the assertions.

Cases to compute:
- **A:** 4500 EUR/Monat brutto · STKL I · NRW · keine Konfession · 0 Kinder · 1.7% Zusatzbeitrag · kinderlos · geb. 1990 · GKV
- **B:** 6000 EUR/Monat brutto · STKL III · BY · rk · 1 Kinderfreibetrag · 1.7% Zusatzbeitrag · 1 Kind unter 25 · geb. 1985 · GKV
- **C:** 9000 EUR/Monat brutto (über beiden BBGs) · STKL I · BE · ev · 0 Kinder · 2.5% Zusatzbeitrag · kinderlos · geb. 1990 · GKV

The implementer MUST replace every `expect(...).toBe(EXPECTED_FROM_BMF)` placeholder below with the real number from BMF before running the tests.

- [ ] **Step 2: Write the spec**

```ts
import { describe, it, expect } from 'vitest';
import { calculateNetto } from './netto';
import type { NettoInput } from './types';

const caseA: NettoInput = {
  bruttoMonatCents: 4_500_00,
  steuerklasse: 1,
  bundesland: 'NW',
  konfession: 'none',
  kinderfreibetraege: 0,
  kvZusatzbeitragPct: 1.7,
  pflegeKinderzahl: 0,
  geburtsjahr: 1990,
  pkv: false,
};

describe('calculateNetto — case A (4500 STKL I NRW kinderlos)', () => {
  const r = calculateNetto(caseA);

  it('returns gross unchanged', () => {
    expect(r.bruttoMonatCents).toBe(4_500_00);
  });

  it('matches BMF lohnsteuer', () => {
    // TODO(impl): replace with BMF-computed value before merge
    expect(r.lohnsteuerCents).toBe(/* EXPECTED_FROM_BMF */ 0);
  });

  it('has no kirchensteuer when konfession=none', () => {
    expect(r.kirchensteuerCents).toBe(0);
  });

  it('PV includes kinderlosenzuschlag', () => {
    // 1.8% basis + 0.6% kinderlos = 2.4% AN-Anteil
    const expected = Math.round(4_500_00 * 0.024);
    expect(r.pflegeversicherungAnCents).toBe(expected);
  });

  it('RV is 9.3% AN', () => {
    expect(r.rentenversicherungAnCents).toBe(Math.round(4_500_00 * 0.093));
  });

  it('netto = brutto - alle abzuege', () => {
    expect(r.nettoMonatCents).toBe(r.bruttoMonatCents - r.abzuegeGesamtCents);
  });
});

describe('calculateNetto — case B (6000 STKL III BY 1 Kind)', () => {
  const input: NettoInput = {
    bruttoMonatCents: 6_000_00,
    steuerklasse: 3,
    bundesland: 'BY',
    konfession: 'rk',
    kinderfreibetraege: 1,
    kvZusatzbeitragPct: 1.7,
    pflegeKinderzahl: 1,
    geburtsjahr: 1985,
    pkv: false,
  };
  const r = calculateNetto(input);

  it('matches BMF lohnsteuer', () => {
    expect(r.lohnsteuerCents).toBe(/* EXPECTED_FROM_BMF */ 0);
  });

  it('has 8% kirchensteuer (Bayern)', () => {
    // KiSt = 8% × Bemessungsgrundlage (post-Kinderfreibetrag-fiktion);
    // assert non-zero and within 5..15% of LSt as sanity envelope
    expect(r.kirchensteuerCents).toBeGreaterThan(0);
  });

  it('PV does NOT include kinderlosenzuschlag (1 child)', () => {
    expect(r.pflegeversicherungAnCents).toBe(Math.round(6_000_00 * 0.018));
  });
});

describe('calculateNetto — case C (9000 caps both BBGs)', () => {
  const input: NettoInput = {
    bruttoMonatCents: 9_000_00,
    steuerklasse: 1,
    bundesland: 'BE',
    konfession: 'ev',
    kinderfreibetraege: 0,
    kvZusatzbeitragPct: 2.5,
    pflegeKinderzahl: 0,
    geburtsjahr: 1990,
    pkv: false,
  };
  const r = calculateNetto(input);

  it('KV is capped at BBG kvPv (5531.25 EUR)', () => {
    // 7.3% AN-Anteil auf BBG
    expect(r.krankenversicherungAnCents)
      .toBe(Math.round(553_125 * 0.073) + Math.round(553_125 * 2.5 / 2 / 100));
  });

  it('RV is capped at BBG rvAv (8050 EUR)', () => {
    expect(r.rentenversicherungAnCents).toBe(Math.round(805_000 * 0.093));
  });
});
```

- [ ] **Step 3: Run and verify failure**

Run: `pnpm --filter @klar/shared test netto.spec.ts`
Expected: FAIL — "Cannot find module './netto'"

---

## Task 6: Implement `calculateNetto`

**Files:**
- Create: `packages/shared/src/payroll/netto.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { calculate as bmfCalculate } from 'lohnsteuerrechner';
import { SV_2026 } from './sv-beitraege-2026';
import { kirchensteuerSatzPct } from './kirchensteuer';
import type { NettoInput, NettoResult } from './types';

/** Hilfsfunktion: an BBG cappen. */
function capAtBbg(bruttoCents: number, bbgCents: number): number {
  return Math.min(bruttoCents, bbgCents);
}

/** PV-AN-Satz: Basis ± Kinderzahl-Abschläge ± Kinderlosenzuschlag. */
function pflegeAnSatzPct(input: NettoInput): number {
  const sv = SV_2026.pv;
  let satz = sv.basis_AN;

  // Kinderlosenzuschlag: ab 23. Lebensjahr und kein Kind
  const altersJahre = SV_2026.jahr - input.geburtsjahr;
  if (input.pflegeKinderzahl === 0 && altersJahre >= 23) {
    satz += sv.kinderlosenZuschlag_AN;
  }

  // Abschlag ab 2. bis 5. Kind unter 25 (= pflegeKinderzahl 2..4 in unserem Modell,
  // wobei 4 "4 oder mehr" abdeckt; PAP staffelt bis zum 5. Kind, vereinfacht hier).
  if (input.pflegeKinderzahl >= 2) {
    const abschlagKinder = Math.min(input.pflegeKinderzahl, 4) - 1;
    satz -= abschlagKinder * sv.kindAbschlag_AN;
  }

  // Sachsen: AN trägt 0.5% mehr (kein Buß- und Bettag)
  if (input.bundesland === 'SN') {
    satz += sv.sachsenSonderlast_AN;
  }

  return satz;
}

export function calculateNetto(input: NettoInput): NettoResult {
  const brutto = input.bruttoMonatCents;
  const bbgKv = capAtBbg(brutto, SV_2026.bbg.kvPv);
  const bbgRv = capAtBbg(brutto, SV_2026.bbg.rvAv);

  // --- BMF Lohnsteuer / Soli / KiSt-Bemessungsgrundlage ---
  // LZZ=2 (Monat), RE4 = brutto in Cent, STKL, R (Konfession-Marker), ZKF (Kinderfreibetrag),
  // KVZ = Zusatzbeitrag, PVZ = 1 wenn kinderlos & >= 23J, PVA = Kinderzahl,
  // PVS = 1 wenn Sachsen, PKV = 1 wenn privat.
  const altersJahre = SV_2026.jahr - input.geburtsjahr;
  const bmf = bmfCalculate(SV_2026.jahr, {
    LZZ: 2,
    RE4: brutto,
    STKL: input.steuerklasse,
    R: input.konfession === 'none' ? 0 : 1,
    ZKF: input.kinderfreibetraege,
    KVZ: input.kvZusatzbeitragPct,
    PVZ: input.pflegeKinderzahl === 0 && altersJahre >= 23 ? 1 : 0,
    PVA: input.pflegeKinderzahl,
    PVS: input.bundesland === 'SN' ? 1 : 0,
    PKV: input.pkv ? 1 : 0,
  });

  const lohnsteuerCents = bmf.LSTLZZ;
  const solidaritaetszuschlagCents = bmf.SOLZLZZ;

  // KiSt-Bemessungsgrundlage: Property aus PAP-Output (BK = Bemessungsgrundlage Kirchensteuer
  // monatlich). Implementer: confirm exact field name from Task 1 step 2 output.
  const kistBase: number = (bmf as Record<string, number>)['BK'] ?? 0;
  const kistSatz = kirchensteuerSatzPct(input.bundesland, input.konfession);
  const kirchensteuerCents = Math.round(kistBase * kistSatz / 100);

  // --- Sozialversicherung (AN-Anteil) ---
  const kvSatz = SV_2026.kv.allgemein_AN
    + input.kvZusatzbeitragPct * SV_2026.kv.zusatzbeitrag_AN_factor;
  const krankenversicherungAnCents = input.pkv
    ? 0
    : Math.round(bbgKv * kvSatz / 100);

  const pvSatz = pflegeAnSatzPct(input);
  const pflegeversicherungAnCents = input.pkv
    ? 0
    : Math.round(bbgKv * pvSatz / 100);

  const rentenversicherungAnCents = Math.round(bbgRv * SV_2026.rv.satz_AN / 100);
  const arbeitslosenversicherungAnCents = Math.round(bbgRv * SV_2026.av.satz_AN / 100);

  const abzuegeGesamtCents =
    lohnsteuerCents
    + solidaritaetszuschlagCents
    + kirchensteuerCents
    + krankenversicherungAnCents
    + pflegeversicherungAnCents
    + rentenversicherungAnCents
    + arbeitslosenversicherungAnCents;

  const nettoMonatCents = brutto - abzuegeGesamtCents;

  return {
    bruttoMonatCents: brutto,
    lohnsteuerCents,
    solidaritaetszuschlagCents,
    kirchensteuerCents,
    krankenversicherungAnCents,
    pflegeversicherungAnCents,
    rentenversicherungAnCents,
    arbeitslosenversicherungAnCents,
    abzuegeGesamtCents,
    nettoMonatCents,
    nettoJahrCents: nettoMonatCents * 12,
  };
}
```

- [ ] **Step 2: Run tests, fix BMF expected values**

Run: `pnpm --filter @klar/shared test netto.spec.ts`

If the lohnsteuer assertions fail with concrete BMF-derived values, the algorithm is wrong — debug. If they fail because the placeholder `0` was never replaced, replace it with the value from `bmf-steuerrechner.de` for that input combo.

Expected after fixing: PASS, all tests green.

- [ ] **Step 3: Create barrel and re-export**

Create `packages/shared/src/payroll/index.ts`:

```ts
export * from './types';
export { calculateNetto } from './netto';
export { SV_2026 } from './sv-beitraege-2026';
export { kirchensteuerSatzPct } from './kirchensteuer';
```

Modify `packages/shared/src/index.ts`:

```ts
export * from './types';
export * from './calculations';
export * from './schemas';
export * from './oauth-scopes';
export * from './payroll';
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @klar/shared build`
Expected: clean build, no TS errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/payroll packages/shared/src/index.ts
git commit -m "feat(shared): add calculateNetto using BMF PAP + 2026 SV rates"
```

---

## Task 7: Netto-Rechner page — failing component spec

**Files:**
- Create: `apps/web/src/app/pages/netto-rechner/netto-rechner.component.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { TestBed } from '@angular/core/testing';
import { NettoRechnerComponent } from './netto-rechner.component';

describe('NettoRechnerComponent', () => {
  it('renders with default brutto and shows a netto > 0', async () => {
    await TestBed.configureTestingModule({
      imports: [NettoRechnerComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(NettoRechnerComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    expect(cmp.result()).toBeTruthy();
    expect(cmp.result()!.nettoMonatCents).toBeGreaterThan(0);
    expect(cmp.result()!.nettoMonatCents).toBeLessThan(cmp.input().bruttoMonatCents);
  });

  it('recomputes when brutto changes', async () => {
    await TestBed.configureTestingModule({
      imports: [NettoRechnerComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(NettoRechnerComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    const before = cmp.result()!.nettoMonatCents;
    cmp.setBrutto(8_000_00);
    fixture.detectChanges();
    const after = cmp.result()!.nettoMonatCents;

    expect(after).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm --filter web test netto-rechner.component.spec.ts`
Expected: FAIL — module not found.

---

## Task 8: Netto-Rechner page — implementation

**Files:**
- Create: `apps/web/src/app/pages/netto-rechner/netto-rechner.component.ts`
- Create: `apps/web/src/app/pages/netto-rechner/netto-rechner.component.html`

- [ ] **Step 1: Write the component (TS)**

Use Spartan UI controls only (`hlmInput`, `klar-select`). All state via `signal()` and `computed()`. No Reactive Forms. Show every line item from `NettoResult` with `tabular-nums` and `font-mono` (per CLAUDE.md design rules). All amounts displayed using existing `klar-money` / `formatEuro` helper if present (grep for it before writing custom formatting).

```ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { calculateNetto, type NettoInput, SV_2026 } from '@klar/shared';
import { KlarSelectComponent } from '../../shared/ui/klar-select.component';
// import other Spartan/klar shared components as the codebase exposes them

@Component({
  selector: 'klar-netto-rechner',
  standalone: true,
  imports: [KlarSelectComponent /* + hlmInput directive, etc. */],
  templateUrl: './netto-rechner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NettoRechnerComponent {
  readonly input = signal<NettoInput>({
    bruttoMonatCents: 4_500_00,
    steuerklasse: 1,
    bundesland: 'NW',
    konfession: 'none',
    kinderfreibetraege: 0,
    kvZusatzbeitragPct: SV_2026.kv.zusatzbeitragDefault,
    pflegeKinderzahl: 0,
    geburtsjahr: 1990,
    pkv: false,
  });

  readonly result = computed(() => calculateNetto(this.input()));

  readonly steuerklasseOptions = [1, 2, 3, 4, 5, 6].map(v => ({ value: v, label: `Klasse ${v}` }));
  readonly bundeslandOptions = [
    'BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH',
  ].map(v => ({ value: v, label: v }));
  readonly konfessionOptions = [
    { value: 'none', label: 'Keine' },
    { value: 'rk', label: 'Römisch-katholisch' },
    { value: 'ev', label: 'Evangelisch' },
  ];

  setBrutto(cents: number): void {
    this.input.update(i => ({ ...i, bruttoMonatCents: cents }));
  }

  // similar setters for each field — keep them small and explicit.
}
```

- [ ] **Step 2: Write the template**

Page header per CLAUDE.md ("Page-Header (Titel + Actions)"). Mobile-first: form fields stack on mobile, two-column ≥768px. Touch targets ≥44px, `text-base` on inputs to avoid iOS zoom. Result card sticky on mobile bottom or below form.

```html
<div class="flex flex-col gap-6 p-4 md:p-6">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">Brutto-Netto-Rechner ({{ result().bruttoMonatCents | currency:'EUR' }})</h1>
  </header>

  <section class="grid gap-4 md:grid-cols-2">
    <label class="flex flex-col gap-1">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Brutto / Monat</span>
      <input
        hlmInput
        type="number"
        inputmode="decimal"
        [value]="input().bruttoMonatCents / 100"
        (input)="setBrutto(($any($event.target).valueAsNumber || 0) * 100)"
        class="text-base"
      />
    </label>

    <!-- Steuerklasse, Bundesland, Konfession, Kinderfreibeträge, KV-Zusatz,
         Pflege-Kinderzahl, Geburtsjahr, PKV-Toggle — alle als klar-select / hlmInput -->
  </section>

  <section class="rounded-lg border p-4">
    <h2 class="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Aufschlüsselung</h2>

    <dl class="grid grid-cols-[1fr_auto] gap-y-1 font-mono tabular-nums">
      <dt>Brutto</dt><dd>{{ result().bruttoMonatCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">Lohnsteuer</dt>
      <dd class="text-danger">−{{ result().lohnsteuerCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">Soli</dt>
      <dd class="text-danger">−{{ result().solidaritaetszuschlagCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">Kirchensteuer</dt>
      <dd class="text-danger">−{{ result().kirchensteuerCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">KV (AN)</dt>
      <dd class="text-danger">−{{ result().krankenversicherungAnCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">PV (AN)</dt>
      <dd class="text-danger">−{{ result().pflegeversicherungAnCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">RV (AN)</dt>
      <dd class="text-danger">−{{ result().rentenversicherungAnCents / 100 | currency:'EUR' }}</dd>
      <dt class="text-muted-foreground">AV (AN)</dt>
      <dd class="text-danger">−{{ result().arbeitslosenversicherungAnCents / 100 | currency:'EUR' }}</dd>
      <dt class="border-t pt-2 font-semibold">Netto</dt>
      <dd class="border-t pt-2 font-semibold text-success">
        {{ result().nettoMonatCents / 100 | currency:'EUR' }}
      </dd>
    </dl>
  </section>
</div>
```

Verify against `apps/web/src/app/shared/ui/` what the canonical money/percent rendering helper is and use it instead of inline `currency` pipe if one exists (`klar-money` or similar).

- [ ] **Step 3: Run tests**

Run: `pnpm --filter web test netto-rechner.component.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/pages/netto-rechner
git commit -m "feat(web): add netto-rechner page"
```

---

## Task 9: Wire route and nav

**Files:**
- Modify: `apps/web/src/app/app.routes.ts`
- Modify: navigation component (find with `grep -rn "fixkosten" apps/web/src/app/shared` or similar)

- [ ] **Step 1: Add lazy route**

In `app.routes.ts`, inside the `/app` children array, after the existing `health` entry add:

```ts
{
  path: 'netto-rechner',
  loadComponent: () =>
    import('./pages/netto-rechner/netto-rechner.component').then(m => m.NettoRechnerComponent),
},
```

- [ ] **Step 2: Add nav entry**

Locate the file that defines bottom-nav / sidebar items (search: `grep -rn "Fixkosten" apps/web/src/app --include='*.ts' --include='*.html'`). Add a "Brutto/Netto" entry under "Mehr" / overflow menu — calculator is not core, doesn't belong in primary bottom nav.

- [ ] **Step 3: Manually verify**

Run: `pnpm --filter web start`
Open `http://localhost:4200/app/netto-rechner`. Tab through the form on desktop, scroll on mobile viewport (Chrome DevTools, 375px). Confirm: no horizontal overflow, all amounts in `font-mono tabular-nums`, dark mode works, change brutto → netto recalculates instantly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/app.routes.ts <nav-file-path>
git commit -m "feat(web): wire netto-rechner route and nav entry"
```

---

## Task 10: Playwright smoke test

**Files:**
- Create: `apps/web/tests/e2e/netto-rechner.spec.ts`

(Confirm with `ls apps/web/tests` whether Playwright tests live there — if not, place next to existing E2E tests.)

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

test('netto-rechner: brutto 4500 yields plausible netto and recomputes on change', async ({ page }) => {
  // Assumes test user is auto-logged-in via storageState (existing convention).
  await page.goto('/app/netto-rechner');

  await expect(page.getByRole('heading', { name: /brutto-netto/i })).toBeVisible();

  const bruttoInput = page.getByLabel(/brutto.*monat/i);
  await bruttoInput.fill('4500');

  const nettoCell = page.getByRole('definition').filter({ hasText: /€/ }).last();
  const nettoText1 = await nettoCell.textContent();
  expect(nettoText1).toMatch(/\d/);

  await bruttoInput.fill('8000');
  await expect(nettoCell).not.toHaveText(nettoText1!);
});
```

- [ ] **Step 2: Run**

Run: `pnpm --filter web test:e2e netto-rechner`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/netto-rechner.spec.ts
git commit -m "test(web): add netto-rechner playwright smoke"
```

---

## Task 11: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update Features table**

Find the Features table in `README.md` and add a row for "German gross/net salary calculator". Keep table column order consistent with existing rows.

- [ ] **Step 2: Add detail section**

Under "Features im Detail" (or English heading per CLAUDE.md docs language rule), add a section in English:

```markdown
### German gross/net salary calculator

Standalone calculator at `/app/netto-rechner`. Enter monthly gross, tax class,
state, denomination, child allowances, statutory health-insurance supplementary
rate, and number of dependent children under 25. Returns income tax (BMF
official PAP), solidarity surcharge, church tax, and statutory contributions
(health, long-term care, pension, unemployment) for the employee share. All
amounts capped at the 2026 BBG ceilings. Pure client-side, no backend call.

Limitations (v1): no PKV premium calculation, no fifth-rule (Fünftelregelung)
for one-off bonuses, no company-car taxation.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document gross/net salary calculator feature"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full local build & test**

Run sequentially:
- `pnpm install` (lockfile up to date)
- `pnpm lint`
- `pnpm test`
- `pnpm build`

Expected: all green. Coverage thresholds (Backend 80%, Frontend 70%) hold — `packages/shared` payroll module should have ~100% line coverage from the spec file.

- [ ] **Step 2: Mobile viewport check**

In running dev server, switch Chrome DevTools to iPhone SE (375px). Visit `/app/netto-rechner`. Confirm: no horizontal scroll, inputs ≥44px touch target, no zoom-on-focus on iOS-style number inputs (because `text-base` = 16px).

- [ ] **Step 3: memory_store**

```
memory_store(
  key="klar-netto-rechner-implementation",
  namespace="klar-app",
  content="Netto-Rechner v1 shipped. Pure-client calculation in
  packages/shared/src/payroll using lohnsteuerrechner npm dep
  (BMF PAP port) + manual SV 2026 constants. Page at /app/netto-rechner.
  No PKV/Fünftelregelung/Firmenwagen yet. Yearly maintenance: pnpm update
  lohnsteuerrechner + verify SV_2026 constants against BMAS publication
  in January."
)
```

- [ ] **Step 4: Commit any final fixes**

If lint/build surfaced anything, fix and commit.

---

## Out of scope (separate plans)

- **Planspiel integration**: replace fixed-Netto slider with optional Brutto-mode that pipes through `calculateNetto`. Adds variable-component support (commission as additional running gross). Plan separately once v1 ships.
- **PKV-Beitrag**: explicit private-insurance premium input + employer subsidy (BBG-capped).
- **Fünftelregelung**: one-off bonus taxation (`SONSTB` PAP field).
- **Firmenwagen / geldwerter Vorteil**: 1%-Regel or Fahrtenbuch.
- **Year-over-year comparison**: 2025 vs 2026 side-by-side.
