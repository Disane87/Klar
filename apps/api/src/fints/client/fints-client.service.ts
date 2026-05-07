import { Injectable, Logger } from '@nestjs/common';
import {
  FinTSClient,
  FinTSConfig,
  type AccountBalanceResponse,
  type StatementResponse,
  type SynchronizeResponse,
  type BankAccount,
} from 'lib-fints';
import type { FintsSessionState } from './fints-session-state';

/** lib-fints does not re-export TanMethod from its index — derive from the method. */
type SelectedTanMethod = ReturnType<FinTSClient['selectTanMethod']>;

/**
 * Thin wrapper around lib-fints (Phase 14a.5).
 *
 * Responsibilities kept inside this service:
 *   - construct FinTSConfig from a bank's connection metadata + decrypted
 *     session state, hiding the lib-fints constructor signature
 *   - expose the operations the Klar sync runner needs: synchronise,
 *     listAccounts, fetchStatements, fetchBalance — plus the TAN-resume
 *     variants for each
 *   - extract the {@link BankingInformation} after every call so the
 *     caller can re-encrypt and persist the freshest session state
 *
 * No request-context, no Prisma, no schedulers — that's the sync runner's
 * job in 14a.7-final.
 *
 * Booking-shape mapping lives in {@link FintsBookingMapper}, not here.
 */
@Injectable()
export class FintsClientService {
  /** Klar's product registration data. ZKA-issued IDs go in env when we apply. */
  private static readonly PRODUCT_ID =
    process.env['FINTS_PRODUCT_ID'] ?? 'klar-dev';
  private static readonly PRODUCT_VERSION =
    process.env['FINTS_PRODUCT_VERSION'] ?? '0.1';

  private readonly logger = new Logger(FintsClientService.name);

  /**
   * Builds a freshly-configured FinTSClient. The caller picks the right
   * factory by checking whether {@link FintsSessionState.bankingInformation}
   * is present.
   */
  buildClient(args: {
    bankUrl: string;
    blz: string;
    loginName: string;
    state: FintsSessionState;
  }): FinTSClient {
    const { bankUrl, blz, loginName, state } = args;
    const config = state.bankingInformation
      ? FinTSConfig.fromBankingInformation(
          FintsClientService.PRODUCT_ID,
          FintsClientService.PRODUCT_VERSION,
          state.bankingInformation,
          loginName,
          state.pin,
          state.tanMethodId,
          state.tanMediaName,
          state.customerId,
        )
      : FinTSConfig.forFirstTimeUse(
          FintsClientService.PRODUCT_ID,
          FintsClientService.PRODUCT_VERSION,
          bankUrl,
          blz,
          loginName,
          state.pin,
          state.customerId,
        );
    return new FinTSClient(config);
  }

  /** Returns the available TAN methods after a fresh first-time-use sync. */
  selectTanMethod(client: FinTSClient, tanMethodId: number): SelectedTanMethod {
    return client.selectTanMethod(tanMethodId);
  }

  /** Forwards the optional TAN-media selection (chipTAN with multiple readers). */
  selectTanMedia(client: FinTSClient, tanMediaName: string): void {
    client.selectTanMedia(tanMediaName);
  }

  /**
   * Initial dialog. Returns the bank's response unchanged so the caller
   * can pick up `requiresTan` / `tanReference` and present a TAN modal.
   */
  synchronize(client: FinTSClient): Promise<SynchronizeResponse> {
    return client.synchronize();
  }

  synchronizeWithTan(
    client: FinTSClient,
    tanReference: string,
    tan?: string,
  ): Promise<SynchronizeResponse> {
    return client.synchronizeWithTan(tanReference, tan);
  }

  /**
   * Returns the bank-account list lib-fints discovered during the most
   * recent successful synchronise(). The setup wizard renders this list
   * and lets the user choose which sub-accounts to attach.
   */
  listAccounts(client: FinTSClient): BankAccount[] {
    return client.config.bankingInformation.upd?.bankAccounts ?? [];
  }

  fetchStatements(
    client: FinTSClient,
    accountNumber: string,
    from?: Date,
    to?: Date,
  ): Promise<StatementResponse> {
    return client.getAccountStatements(accountNumber, from, to);
  }

  fetchStatementsWithTan(
    client: FinTSClient,
    tanReference: string,
    tan?: string,
  ): Promise<StatementResponse> {
    return client.getAccountStatementsWithTan(tanReference, tan);
  }

  fetchBalance(
    client: FinTSClient,
    accountNumber: string,
  ): Promise<AccountBalanceResponse> {
    return client.getAccountBalance(accountNumber);
  }

  fetchBalanceWithTan(
    client: FinTSClient,
    tanReference: string,
    tan?: string,
  ): Promise<AccountBalanceResponse> {
    return client.getAccountBalanceWithTan(tanReference, tan);
  }

  /**
   * Snapshots the BankingInformation after a successful call so the
   * caller can re-encrypt and persist. lib-fints mutates the config in
   * place — we always read it fresh.
   */
  extractSessionState(
    client: FinTSClient,
    base: FintsSessionState,
  ): FintsSessionState {
    return {
      ...base,
      bankingInformation: client.config.bankingInformation,
      tanMethodId: client.config.tanMethodId ?? base.tanMethodId,
      tanMediaName: client.config.tanMediaName ?? base.tanMediaName,
      customerId: client.config.customerId ?? base.customerId,
    };
  }
}
