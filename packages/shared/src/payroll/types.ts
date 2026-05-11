// Public types for the German gross-to-net (Brutto-Netto) calculator.
// All monetary amounts are signed integer cents — never floats, per CLAUDE.md.

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

export type Bundesland =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export type Krankenversicherung = 'gesetzlich' | 'privat';
export type RentenversicherungRegion = 'west' | 'ost';
export type GrossPeriod = 'monthly' | 'yearly';

export interface GrossToNetInput {
  /** Gross amount in cents — interpretation depends on `period`. */
  grossCents: number;
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
