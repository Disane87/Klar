export type TransactionKind =
  | 'STANDING_ORDER'
  | 'DIRECT_DEBIT'
  | 'TRANSFER'
  | 'CARD'
  | 'FEE'
  | 'OTHER';

export interface KindInput {
  /** FinTS GVC (MT940) or CAMT SubFamilyCode. */
  bookingType?: string;
  /** Raw stitched purpose string (mapper output). */
  purposeRaw?: string;
}

// MT940 GVC codes for standing-order bookings:
//   158 = Dauerauftragsgutschrift / -lastschrift
//   159 = Dauerauftrag (Spar/Termineinlage)
//   164 = Dauerauftrag Eingang
//   166 = Dauerauftrag durch Kreditinstitut (institution-executed)
const STANDING_ORDER_GVC = new Set(['158', '159', '164', '166']);
const DIRECT_DEBIT_GVC = new Set(['005']);
const TRANSFER_GVC = new Set(['020', '051', '052', '053', '054']);
const CARD_GVC = new Set(['105', '109']);
const FEE_GVC = new Set(['808', '809', '830', '835']);

const STANDING_ORDER_CAMT = new Set(['STDO']);
const DIRECT_DEBIT_CAMT = new Set(['DDBE', 'DAJT']);

export function detectTransactionKind(input: KindInput): TransactionKind {
  const code = (input.bookingType ?? '').trim().toUpperCase();

  if (STANDING_ORDER_GVC.has(code) || STANDING_ORDER_CAMT.has(code)) {
    return 'STANDING_ORDER';
  }
  if (DIRECT_DEBIT_GVC.has(code) || DIRECT_DEBIT_CAMT.has(code)) {
    return 'DIRECT_DEBIT';
  }
  if (CARD_GVC.has(code)) return 'CARD';
  if (TRANSFER_GVC.has(code)) return 'TRANSFER';
  if (FEE_GVC.has(code)) return 'FEE';

  // Intentional prefix match — catches 'Dauerauftrag', 'Daueraufträge', and
  // bank-specific compounds where the umlaut splits the root (e.g. 'Daueraufträglich').
  if (input.purposeRaw && /dauerauftr/i.test(input.purposeRaw)) {
    return 'STANDING_ORDER';
  }
  // Own-account transfers: Sparkasse stamps these as "ÜBERTRAG" (with TR);
  // VR-Banks/HypoVereinsbank use "UMBUCHUNG". Both mean "moved money
  // between two of MY accounts at this bank" — they're not real income/
  // expense and must drop out of the monthly cashflow. Note: matching
  // "ÜBERWEISUNG" alone would be too broad (every SEPA payment carries
  // GUTSCHRIFT ÜBERWEISUNG); the discriminating root is `ÜBERTRAG`/UMBUCHUNG.
  if (input.purposeRaw && /(?:^|\b)(?:übertrag|umbuchung)/i.test(input.purposeRaw)) {
    return 'TRANSFER';
  }
  return 'OTHER';
}
