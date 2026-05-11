// German statutory health insurances (gesetzliche Krankenkassen) and their
// 2026 Zusatzbeitrag (additional contribution percentage).
//
// Verified against zusatzbeitrag.net and krankenkasseninfo.de in May 2026.
// Range across all GKV in 2026: 2.18 % – 4.39 %.
// Population-weighted average (BMG): 2.9 %.
//
// Update annually in January when funds publish their new Verwaltungsrats-
// Beschlüsse. The list intentionally focuses on the most popular funds — when
// a user's fund is missing, the "manuell" sentinel lets them enter their own
// rate directly.

export interface Krankenkasse {
  /** Stable id used as the select option value. */
  id: string;
  /** Display name shown in the select. */
  name: string;
  /** Zusatzbeitrag as a percentage (e.g. 2.69 means 2.69 %). */
  zusatzbeitragPct: number;
}

export const KRANKENKASSEN_2026: readonly Krankenkasse[] = [
  // bundesweit
  { id: 'tk',          name: 'Techniker Krankenkasse (TK)',  zusatzbeitragPct: 2.69 },
  { id: 'barmer',      name: 'BARMER',                        zusatzbeitragPct: 3.29 },
  { id: 'dak',         name: 'DAK-Gesundheit',                zusatzbeitragPct: 3.20 },
  { id: 'kkh',         name: 'KKH Kaufmännische Krankenkasse', zusatzbeitragPct: 3.78 },
  { id: 'hek',         name: 'HEK Hanseatische Krankenkasse',  zusatzbeitragPct: 2.89 },
  { id: 'knappschaft', name: 'Knappschaft',                    zusatzbeitragPct: 4.30 },

  // AOK (regional)
  { id: 'aok-by',      name: 'AOK Bayern',                    zusatzbeitragPct: 2.69 },
  { id: 'aok-bw',      name: 'AOK Baden-Württemberg',         zusatzbeitragPct: 2.99 },
  { id: 'aok-he',      name: 'AOK Hessen',                    zusatzbeitragPct: 2.98 },
  { id: 'aok-ni',      name: 'AOK Niedersachsen',             zusatzbeitragPct: 2.98 },
  { id: 'aok-nordost', name: 'AOK Nordost',                   zusatzbeitragPct: 3.50 },
  { id: 'aok-plus',    name: 'AOK PLUS (Sachsen/Thüringen)',  zusatzbeitragPct: 3.10 },
  { id: 'aok-rps',     name: 'AOK Rheinland-Pfalz/Saarland',  zusatzbeitragPct: 2.47 },
  { id: 'aok-rh-hh',   name: 'AOK Rheinland/Hamburg',         zusatzbeitragPct: 3.29 },
  { id: 'aok-st',      name: 'AOK Sachsen-Anhalt',            zusatzbeitragPct: 2.89 },
  { id: 'aok-hb',      name: 'AOK Bremen/Bremerhaven',        zusatzbeitragPct: 3.29 },
  { id: 'aok-nordwest',name: 'AOK NordWest',                  zusatzbeitragPct: 2.99 },

  // IKK
  { id: 'ikk-classic', name: 'IKK classic',                   zusatzbeitragPct: 3.40 },

  // BKK
  { id: 'bkk-firmus',  name: 'BKK firmus',                    zusatzbeitragPct: 2.18 },
  { id: 'audi-bkk',    name: 'Audi BKK',                      zusatzbeitragPct: 2.60 },
  { id: 'hkk',         name: 'hkk Krankenkasse',              zusatzbeitragPct: 2.59 },
  { id: 'bkk-linde',   name: 'BKK Linde',                     zusatzbeitragPct: 2.99 },
  { id: 'rv-bkk',      name: 'R+V Betriebskrankenkasse',      zusatzbeitragPct: 3.49 },
  { id: 'salus-bkk',   name: 'Salus BKK',                     zusatzbeitragPct: 3.29 },
  { id: 'big',         name: 'BIG direkt gesund',             zusatzbeitragPct: 3.69 },
  { id: 'mhplus',      name: 'mhplus BKK',                    zusatzbeitragPct: 3.86 },
  { id: 'mobil',       name: 'Mobil Krankenkasse',            zusatzbeitragPct: 3.89 },
  { id: 'viactiv',     name: 'VIACTIV',                       zusatzbeitragPct: 4.19 },
];

/** Sentinel id for "manuell eintragen" — not in the curated list. */
export const KRANKENKASSE_MANUAL_ID = '__manual__';
