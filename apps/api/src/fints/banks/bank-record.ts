/**
 * BankRecord (Phase 14a.4) — one entry from the BLZ registry.
 *
 * Source format is hbci4j's blz.properties (pipe-delimited):
 *   <blz>=<name>|<city>|<bic>|<numericCode>|<host>|<url>|<port>|<port>|
 *
 * `pinTanUrl` is empty when the bank does not advertise a FinTS PIN/TAN
 * endpoint. Lookup callers check `fintsCapable` rather than parsing the
 * URL themselves.
 */
export interface BankRecord {
  blz: string;
  name: string;
  city?: string;
  bic?: string;
  /** hbci4j's numeric capability code; passed through verbatim. */
  numericCode?: string;
  host?: string;
  pinTanUrl?: string;
  pinTanVersion?: string;
  hbciVersion?: string;
}

export type BankLookupResult =
  | {
      found: true;
      record: BankRecord;
      fintsCapable: boolean;
      message?: string;
    }
  | {
      found: false;
      allowManualOverride: true;
    };
