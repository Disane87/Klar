import type { BankRecord } from './bank-record';

/**
 * Cold-start fallback for the BLZ registry. The blz-refresh routine
 * replaces the in-memory cache with the live hbci4j snapshot on first
 * successful fetch. Keep this list small — only the most common German
 * banks — to keep the binary lean.
 *
 * Source: hand-curated subset of hbci4j's blz.properties as of
 * 2026-05-07. URLs and BICs may go stale; the live refresh will fix it.
 */
export const BANKS_FALLBACK: { records: BankRecord[] } = {
  records: [
    {
      blz: '37050198',
      name: 'Sparkasse KölnBonn',
      city: 'Köln',
      bic: 'COLSDE33XXX',
      pinTanUrl: 'https://banking-rl5.s-fints-pt-rl.de/fints30',
      pinTanVersion: '300',
      hbciVersion: '300',
    },
    {
      blz: '10070000',
      name: 'Deutsche Bank',
      city: 'Berlin',
      bic: 'DEUTDEBBXXX',
      pinTanUrl: 'https://fints.deutsche-bank.de/fintsServer',
      pinTanVersion: '300',
      hbciVersion: '300',
    },
    {
      blz: '12030000',
      name: 'DKB Deutsche Kreditbank',
      city: 'Berlin',
      bic: 'BYLADEM1001',
      pinTanUrl: 'https://banking-dkb.s-fints-pt-dkb.de/fints30',
      pinTanVersion: '300',
      hbciVersion: '300',
    },
    {
      blz: '20041111',
      name: 'comdirect',
      city: 'Quickborn',
      bic: 'COBADEHD044',
      pinTanUrl: 'https://fints.comdirect.de/fints',
      pinTanVersion: '300',
      hbciVersion: '300',
    },
    {
      blz: '50010517',
      name: 'ING-DiBa',
      city: 'Frankfurt am Main',
      bic: 'INGDDEFFXXX',
      pinTanUrl: 'https://fints.ing-diba.de/fints/',
      pinTanVersion: '300',
      hbciVersion: '300',
    },
  ],
};
