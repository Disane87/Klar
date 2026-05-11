// Curated list of German statutory health insurances (gesetzliche
// Krankenkassen) and their additional contribution rate (Zusatzbeitrag) for
// 2026. Values are the rates each fund officially announced for 2026 (or, when
// the 2026 figure was not yet published at curation time, the most recent
// 2025 value — these get refreshed annually). UI lets the user override with
// a custom percentage when their fund is not in the list.
//
// Source patterns: GKV-Spitzenverband publication and the funds' own 2026
// Verwaltungsrats-Beschlüsse.

export interface Krankenkasse {
  /** Stable id used as the select option value. */
  id: string;
  /** Display name shown in the select. */
  name: string;
  /** Zusatzbeitrag as a percentage (e.g. 2.45 means 2.45 %). */
  zusatzbeitragPct: number;
}

export const KRANKENKASSEN_2026: readonly Krankenkasse[] = [
  // bundesweit / Ersatzkassen
  { id: 'tk',         name: 'Techniker Krankenkasse (TK)', zusatzbeitragPct: 2.45 },
  { id: 'barmer',     name: 'BARMER',                       zusatzbeitragPct: 3.29 },
  { id: 'dak',        name: 'DAK-Gesundheit',               zusatzbeitragPct: 3.40 },
  { id: 'kkh',        name: 'KKH Kaufmännische Krankenkasse', zusatzbeitragPct: 3.30 },
  { id: 'hek',        name: 'HEK Hanseatische Krankenkasse', zusatzbeitragPct: 3.10 },

  // AOK (regional)
  { id: 'aok-by',     name: 'AOK Bayern',                   zusatzbeitragPct: 2.99 },
  { id: 'aok-bw',     name: 'AOK Baden-Württemberg',        zusatzbeitragPct: 3.10 },
  { id: 'aok-ni',     name: 'AOK Niedersachsen',            zusatzbeitragPct: 2.99 },
  { id: 'aok-nordost',name: 'AOK Nordost',                  zusatzbeitragPct: 3.39 },
  { id: 'aok-plus',   name: 'AOK PLUS (Sachsen/Thüringen)', zusatzbeitragPct: 2.59 },
  { id: 'aok-rh-hh',  name: 'AOK Rheinland/Hamburg',        zusatzbeitragPct: 2.55 },
  { id: 'aok-wl',     name: 'AOK Westfalen-Lippe',          zusatzbeitragPct: 3.20 },

  // IKK
  { id: 'ikk-classic', name: 'IKK classic',                 zusatzbeitragPct: 3.00 },

  // BKK (popular)
  { id: 'big',         name: 'BIG direkt gesund',           zusatzbeitragPct: 2.00 },
  { id: 'hkk',         name: 'hkk Krankenkasse',            zusatzbeitragPct: 1.18 },
  { id: 'mhplus',      name: 'mhplus BKK',                  zusatzbeitragPct: 2.59 },
  { id: 'mobil',       name: 'Mobil Krankenkasse',          zusatzbeitragPct: 2.69 },
  { id: 'viactiv',     name: 'VIACTIV',                     zusatzbeitragPct: 2.95 },
  { id: 'bkk-mob-oil', name: 'BKK Mobil Oil',               zusatzbeitragPct: 2.89 },
  { id: 'audi-bkk',    name: 'Audi BKK',                    zusatzbeitragPct: 2.40 },
];

/** Sentinel id for "manuell eintragen" — not in the list. */
export const KRANKENKASSE_MANUAL_ID = '__manual__';
