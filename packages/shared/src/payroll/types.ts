// Public types for the German gross-to-net (Brutto-Netto) calculator.
// All monetary amounts are signed integer cents — never floats, per CLAUDE.md.

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

export type Bundesland =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export type Krankenversicherung = 'gesetzlich' | 'privat';
export type RentenversicherungRegion = 'west' | 'ost';
export type GrossPeriod = 'monthly' | 'yearly';

/**
 * One line item from a Lohnzettel — e.g. "Festgehalt", "Provision",
 * "Schichtzulage". The total brutto used in the tax calculation is the
 * sum of all positions. UI only — the engine simply sums them.
 */
export interface PayrollPosition {
  /** Stable identifier (UUID or generated string). Used only by the UI. */
  id: string;
  /** Display name shown next to the amount. */
  label: string;
  /** Signed integer cents. Interpretation follows the parent `period`. */
  amountCents: number;
}

export interface GrossToNetInput {
  /**
   * Total gross amount in cents — interpretation depends on `period`.
   * Used as the brutto basis when `positions` is omitted or empty.
   * When `positions` has entries, their sum overrides this value.
   */
  grossCents: number;
  /**
   * Optional list of brutto line items (e.g. Festgehalt + Provision).
   * When provided and non-empty, their sum is the effective brutto.
   * Each amount uses the same `period` as the parent input.
   */
  positions?: PayrollPosition[];
  period: GrossPeriod;
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  /** Liable to church tax (Kirchensteuer)? */
  kirchensteuer: boolean;
  /** 4-digit birth year — used for Pflegeversicherung-Kinderlosenzuschlag (>23 without children). */
  birthYear: number;
  /** Number of Kinderfreibeträge — typically 0, 0.5, 1, 1.5, ... 8. */
  kinderfreibetraege: number;
  krankenversicherung: Krankenversicherung;
  /** Additional KV contribution percentage — e.g. 1.7 for 1.7%. Ignored when private. */
  kvZusatzbeitragPct: number;
  /** Total monthly PKV contribution in cents — only used when krankenversicherung === 'privat'. */
  pkvBeitragMonthlyCents?: number;
  rentenversicherungRegion: RentenversicherungRegion;
  /** Geldwerter Vorteil (e.g. company car) — added to taxable gross, then deducted from net pay. */
  geldwerterVorteilMonthlyCents: number;
  /** Annual Lohnsteuer-Freibetrag from ELStAM — reduces taxable income. */
  lohnsteuerFreibetragYearlyCents: number;
}

export interface NetBreakdown {
  bruttoCents: number;
  lohnsteuerCents: number;
  soliCents: number;
  kirchensteuerCents: number;
  /** Krankenversicherung — employee share (or full PKV contribution). */
  kvCents: number;
  /** Pflegeversicherung — employee share. */
  pvCents: number;
  /** Rentenversicherung — employee share. */
  rvCents: number;
  /** Arbeitslosenversicherung — employee share. */
  avCents: number;
  /** Sum: lohnsteuer + soli + kirchensteuer. */
  steuernCents: number;
  /** Sum: kv + pv + rv + av. */
  sozialabgabenCents: number;
  /** Net pay after taxes and social-insurance contributions. */
  nettoCents: number;
}

export interface NetResult {
  monthly: NetBreakdown;
  yearly: NetBreakdown;
}

/**
 * Persisted Gehaltsrechner state for a user. Mirrors `GrossToNetInput`
 * but is decoupled to keep the API/storage shape stable when the
 * calculation engine evolves. All fields are optional so older or
 * partially saved snapshots can still hydrate.
 */
export interface PayrollCalculatorState {
  positions?: PayrollPosition[];
  period?: GrossPeriod;
  steuerklasse?: Steuerklasse;
  bundesland?: Bundesland;
  kirchensteuer?: boolean;
  birthYear?: number;
  kinderfreibetraege?: number;
  krankenversicherung?: Krankenversicherung;
  /** Selected Krankenkasse ID — `manual` keeps the user-typed Zusatzbeitrag. */
  krankenkasseId?: string;
  kvZusatzbeitragPct?: number;
  pkvBeitragMonthlyCents?: number | null;
  rentenversicherungRegion?: RentenversicherungRegion;
  geldwerterVorteilMonthlyCents?: number | null;
  lohnsteuerFreibetragYearlyCents?: number | null;
}
