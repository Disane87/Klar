# Brutto-Netto-Rechner — Design

Status: approved 2026-05-11
Author: Claude (brainstormed with Marco)

## Goal

Add a German payroll (gross-to-net) calculator to Klar. Two entry points:

1. **Standalone tool** at `/tools/brutto-netto` — Marco enters gross monthly salary plus tax/social parameters and immediately sees a full breakdown plus visualization.
2. **"From gross" mode in Fixkosten dialogs** — when a `RecurringTransaction` represents salary (positive `amountCents`), Marco can compute the net from gross instead of typing the net by hand. Inputs are persisted on the recurring entry so the calculation can be re-run later (e.g. after a KV-Zusatzbeitrag change).

## Non-goals

- Multi-year support — 2026 only. (Yearly update in January is a 2h job.)
- Server-side calculation — the engine is shared TS, runs in browser. Backend only stores the JSON input on the recurring entry.
- Externer BMF-API call — fully offline, deterministic.

## Architecture

### `packages/shared/src/payroll/` — calculation engine

Pure TypeScript, no Angular/Nest deps. Lives in shared per CLAUDE.md "Berechnungs-Logik nur in `packages/shared`".

```
packages/shared/src/payroll/
  index.ts                  re-exports
  types.ts                  GrossToNetInput, NetResult, Steuerklasse, Bundesland
  constants-2026.ts         Beitragsbemessungsgrenzen, KV/PV/RV/AV-Sätze 2026
  einkommensteuer-2026.ts   §32a EStG Tarif (5 Tarifzonen), pure function
  vorsorgepauschale.ts      §39b Abs. 2 Satz 5 Nr. 3 EStG
  lohnsteuer-2026.ts        Lohnsteuer per Jahresarbeitslohn-Methode
  social-insurance-2026.ts  KV/PV/RV/AV — AN-Anteil; PV-Kinderlosenzuschlag; PKV-Pfad
  gross-to-net.ts           High-level wrapper: calculateNet(input) -> NetResult
  __tests__/
    einkommensteuer-2026.spec.ts
    social-insurance-2026.spec.ts
    gross-to-net.spec.ts    truth-table with BMF reference values (~30 cases)
```

**Engineering note (honest):** the BMF Programmablaufplan (PAP) is ~3000 lines of pseudo-code with many branches. A full port is the long-term goal. **For this iteration we ship a §32a-based engine** that implements:

- §32a EStG income tax formula (5 segments, exact)
- Vorsorgepauschale per §39b EStG (KV/PV/RV/AV components, capped at Beitragsbemessungsgrenze)
- Werbungskostenpauschale (1230€/y), Sonderausgabenpauschbetrag (36€/y)
- Steuerklassen 1–6 via Grundfreibetrag splitting + monthly conversions
- Kinderfreibetrag (only affects Soli + Kirchensteuer per German law — not Lohnsteuer in StKl 1/2/3/4)
- Solidaritätszuschlag with 2026 Freigrenze (Milderungszone)
- Kirchensteuer 8% (Bayern, BW) / 9% (rest)
- Soziale Sicherheit: KV (14.6% + Zusatzbeitrag), PV (3.4%, kinderlos > 23 +0.6%, Sachsen Sonderregel), RV (18.6%, BBG West/Ost), AV (2.6%)
- PKV alternative: KV-Beitrag manuell, PV gesetzlich

Accuracy target: **within ±5 EUR/month vs. BMF online calculator** for a 30-case truth table covering StKl 1–6 × {2k, 3.5k, 5k, 8k, 12k} EUR brutto × {with/without children, with/without church, gesetzlich/privat}. Truth table values are generated once via the BMF online calculator and committed as test fixtures. Cases that exceed ±5 EUR are flagged in the spec as known-deviation (typically very high incomes near BBG inflection points).

**Migration path to full PAP** is a future task tracked as `// TODO(payroll): full BMF PAP 2026 port` in `lohnsteuer-2026.ts`. Engine API stays the same — only the internals change.

### `apps/web/src/app/pages/tools/brutto-netto/` — standalone page

- Route `/app/tools/brutto-netto` (added to app routes)
- Hero via `<klar-hero>` (eyebrow "Tools", title "Brutto-Netto-Rechner")
- Two columns desktop / stacked mobile:
  - Left: Signal Forms with all input fields (defaults from user profile where possible)
  - Right: result card with big monthly net, donut chart, breakdown table
- Live calculation via `computed()` on signal inputs — no submit button
- Toggle "Jahreswerte anzeigen" — multiplies all amounts by 12

### Fixkosten integration

- `recurring-edit-dialog.component.ts` and `recurring-create-dialog.component.ts` get a new optional "Aus Brutto berechnen" toggle visible only when `amountCents > 0` (income).
- When enabled, an inline section appears with the same form fields as the tool page (compact one-column layout) plus inline donut + breakdown.
- "Übernehmen" writes the computed net into `amountCents` and stores the input as `payrollInput` on the recurring entry.
- When editing an entry that already has `payrollInput`, the toggle is on by default, the form is pre-filled, and re-computing updates the net.

### Backend changes

- `RecurringTransaction.payrollInput Json?` (nullable, optional). Stores the `GrossToNetInput` JSON.
- `RecurringTransactionsController` PATCH/POST DTOs accept optional `payrollInput?: GrossToNetInputDto` (validated via class-validator + zod schema in shared).
- Repository persists the JSON. No server-side calculation — the client computed the net before sending.
- Swagger annotations per CLAUDE.md OpenAPI rules: `@ApiProperty({ type: Object, description, example })` on the DTO field.

## Data model

```ts
type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;
type Bundesland =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

interface GrossToNetInput {
  grossCents: number;             // monthly OR yearly per `period`
  period: 'monthly' | 'yearly';
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  kirchensteuer: boolean;
  birthYear: number;              // for PV-Kinderlosenzuschlag (>23) and RV-East/West
  kinderfreibetraege: number;     // 0, 0.5, 1, 1.5, ... 8
  krankenversicherung: 'gesetzlich' | 'privat';
  kvZusatzbeitragPct: number;     // default 1.7
  pkvBeitragMonthlyCents?: number; // when krankenversicherung === 'privat'
  rentenversicherungRegion: 'west' | 'ost';
  geldwerterVorteilMonthlyCents: number; // default 0
  lohnsteuerFreibetragYearlyCents: number; // default 0 (ELStAM)
}

interface NetResult {
  monthly: NetBreakdown;
  yearly: NetBreakdown;
}

interface NetBreakdown {
  bruttoCents: number;
  lohnsteuerCents: number;
  soliCents: number;
  kirchensteuerCents: number;
  kvCents: number;     // AN-Anteil (or PKV)
  pvCents: number;     // AN-Anteil
  rvCents: number;     // AN-Anteil
  avCents: number;     // AN-Anteil
  steuernCents: number;       // = LSt + Soli + KiSt
  sozialabgabenCents: number; // = KV + PV + RV + AV
  nettoCents: number;
}
```

All amounts as signed integer cents. Engine functions take/return `NetResult` only — never floats, never strings.

## UI

### Tool page

- Hero (`<klar-hero>`)
- Two-column on `lg:` (form sticky left, result right). Stacked on mobile.
- Form (Signal Forms):
  - Brutto + period toggle (Monat/Jahr) using `klar-money-input` and `klar-select`
  - Steuerklasse (`klar-select` 1–6)
  - Bundesland (`klar-select`)
  - Kirchensteuer (`klar-switch`)
  - Geburtsjahr (`hlmInput type=number`)
  - Kinderfreibeträge (`klar-select` 0..8 in 0.5 steps)
  - KV (`klar-select` gesetzlich/privat) + Zusatzbeitrag % (number) OR PKV-Beitrag (`klar-money-input`)
  - RV-Region (`klar-select` west/ost)
  - Geldwerter Vorteil/Monat (optional, `klar-money-input`)
  - Lohnsteuer-Freibetrag/Jahr (optional, `klar-money-input`)
- Result card (right):
  - Big net amount (Fraunces 32px) + "/ Monat"
  - `klar-donut-chart` 3 segments: Netto, Steuern, Sozialabgaben (with legend)
  - Breakdown table (kompakt, `font-mono tabular-nums`, semantic colors): Brutto · LSt · Soli · KiSt · KV · PV · RV · AV · Netto
  - "Jahreswerte anzeigen" toggle — flips table to ×12

### `klar-donut-chart` (new shared component)

- Lives at `apps/web/src/app/shared/ui/klar-donut-chart.component.ts`
- Inputs: `segments: { label: string; valueCents: number; color: string }[]`, optional `centerLabel`
- Pure SVG, ~80 LOC, no chart-lib dependency
- Reusable beyond payroll (CLAUDE.md: avoid one-off components when reuse is plausible — donut is plausible elsewhere)

### Fixkosten dialog integration

In `recurring-edit-dialog.component.ts` and `recurring-create-dialog.component.ts`:

- New section (visible only when amount is positive / income context) with header "Gehalt aus Brutto berechnen" and a `klar-switch`.
- When on: compact form (same fields as tool page minus Hero) + small donut + breakdown table.
- "Übernehmen" button writes `nettoCents` into the dialog's `amountCents` signal and prepares `payrollInput` for save.
- On save: PATCH/POST includes `payrollInput`.
- On open with existing `payrollInput`: toggle pre-on, form pre-filled.

## Testing

### Engine

- `einkommensteuer-2026.spec.ts` — §32a formula at segment boundaries (12096€, 17443€, 68480€, 277825€) + 10 spot values
- `social-insurance-2026.spec.ts` — KV/PV/RV/AV at typical brutto + at BBG (5512.50 KV, 8050 RV-West, 7950 RV-Ost) + PV-Kinderlosenzuschlag + Sachsen rule
- `gross-to-net.spec.ts` — 30-case truth table generated from BMF online calculator (committed as JSON fixture). Each case asserts net within ±5 EUR/month.

### Frontend

- Tool page component spec: form bound to signals, result reflects engine output
- Fixkosten dialog spec: toggle reveals form, "Übernehmen" updates `amountCents`, save POSTs `payrollInput`
- `klar-donut-chart` snapshot spec

### Playwright

- `e2e/brutto-netto-tool.spec.ts` — navigate `/app/tools/brutto-netto`, fill StKl 1, brutto 4000, expect net in plausible range, expect donut visible
- `e2e/fixkosten-from-gross.spec.ts` — open recurring create dialog, enable "Aus Brutto berechnen", fill, übernehmen, save, verify entry has expected amount

### Coverage

- `packages/shared/payroll/**` ≥ 90% (engine is critical, deserves higher bar than the 80% shared default)
- Frontend per project default (≥ 70%)

## Phases / commits

1. **Engine** — `packages/shared/src/payroll/*` + tests + truth table fixture. Single commit: `feat(payroll): add 2026 gross-to-net calculation engine`.
2. **`klar-donut-chart`** — new shared UI component + spec. Commit: `feat(ui): add klar-donut-chart component`.
3. **Tool page** — `/app/tools/brutto-netto` route + page component + nav entry under "Mehr". Commit: `feat(tools): add gross-to-net calculator page`.
4. **Fixkosten integration** — Prisma migration + DTO + dialog changes. Commit: `feat(fixkosten): compute salary net from gross input`.
5. **README + Playwright** — README features section update + 2 e2e specs. Commit: `docs(readme): document gross-to-net calculator + e2e tests`.

Each commit: `pnpm lint && pnpm test` green per CLAUDE.md DoD.

## Risks / open items

- **Engine accuracy**: §32a-based engine is not pixel-perfect to BMF PAP. Acceptance: ±5 EUR/month for our truth table. If a future case exceeds this, it gets added to the truth table and the engine is patched.
- **Bundesland/RV-Region/Geburtsjahr in user profile**: defaults pulled from `User` if those columns exist. **Verification step in phase 1**: grep `User` model in `prisma/schema.prisma`. If missing, defaults are hardcoded (StKl 1, NW, west, current year − 30) and adding profile fields is out of scope for this spec.
- **PKV-Beitrag input**: user enters total monthly PKV cost; engine treats it as the AN-Anteil (no AG-share calculation needed since gross-to-net is from the employee perspective).
- **Soli-Milderungszone**: implemented per 2026 thresholds (Freigrenze 19,950 EUR LSt for StKl 1/2/4/5/6, double for StKl 3).

## Out of scope

- Lohnsteuer-Klassen-Wechsel-Beratung (StKl 3/5 vs 4/4 mit Faktor)
- Year-end Lohnsteuerbescheinigung simulation
- Saving the standalone tool's last input to user settings (toolbar resets each visit)
- Multi-year comparison
