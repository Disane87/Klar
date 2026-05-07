import type { BankingInformation } from 'lib-fints';

/**
 * The plaintext payload sealed inside FintsConnection.credentialsCipher.
 *
 * `pin` is required for every lib-fints call (FinTS keeps no server-side
 * session past the SCA window). `bankingInformation` is the BPD/UPD blob
 * returned by `synchronize()` — re-using it on subsequent syncs lets us
 * skip the BPD discovery dialog and reuse the negotiated TAN method.
 *
 * Re-encrypted after every successful call, so a stale snapshot never
 * lingers in the DB.
 */
export interface FintsSessionState {
  pin: string;
  bankingInformation?: BankingInformation;
  /** ID of the TAN method the user picked at setup. */
  tanMethodId?: number;
  /** Optional TAN-media name (for chipTAN with multiple readers). */
  tanMediaName?: string;
  /** Optional customer ID when distinct from userId. */
  customerId?: string;
}
