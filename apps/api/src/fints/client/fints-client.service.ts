import { Injectable, Logger } from '@nestjs/common';
import type {
  FinTSClient,
  AccountBalanceResponse,
  StatementResponse,
  SynchronizeResponse,
  BankAccount,
} from 'lib-fints';
import type { FintsSessionState } from './fints-session-state';
import { loadLibFints } from './lib-fints-loader';

/**
 * lib-fints ships ESM-only (`"type": "module"` + import-only `exports`),
 * so a static `import { FinTSClient } from 'lib-fints'` cannot resolve at
 * runtime under our CommonJS build. TypeScript with `module: commonjs`
 * also rewrites a direct `await import('lib-fints')` into a
 * `Promise.resolve().then(() => require('lib-fints'))` — which then
 * fails at runtime with ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * We therefore put the dynamic import in a sibling plain-JS module
 * (`lib-fints-loader.js`) that tsc does not compile. Node executes the
 * native `import()` there and returns the resolved ESM module.
 *
 * Types are imported with `import type`, so they're stripped at compile
 * time and never trigger a runtime require.
 */
type LibFintsModule = typeof import('lib-fints');

/** lib-fints does not re-export TanMethod from its index — derive from the method. */
type SelectedTanMethod = ReturnType<FinTSClient['selectTanMethod']>;

/**
 * Thin wrapper around lib-fints (Phase 14a.5 + ESM-loader fix).
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
 * Because lib-fints is ESM-only, the buildClient() entry is async — the
 * loader resolves on first use and is cached.
 */
@Injectable()
export class FintsClientService {
  /** Klar's product registration data. ZKA-issued IDs go in env when we apply. */
  private static readonly PRODUCT_ID =
    process.env['FINTS_PRODUCT_ID'] ?? 'klar-dev';
  private static readonly PRODUCT_VERSION =
    process.env['FINTS_PRODUCT_VERSION'] ?? '0.1';

  private readonly logger = new Logger(FintsClientService.name);
  private libPromise: Promise<LibFintsModule> | null = null;

  /** Loads lib-fints once, lazily, and caches the module. */
  private lib(): Promise<LibFintsModule> {
    if (!this.libPromise) {
      this.libPromise = loadLibFints();
    }
    return this.libPromise;
  }

  /**
   * Builds a freshly-configured FinTSClient. The caller picks the right
   * factory by checking whether {@link FintsSessionState.bankingInformation}
   * is present.
   */
  async buildClient(args: {
    bankUrl: string;
    blz: string;
    loginName: string;
    state: FintsSessionState;
  }): Promise<FinTSClient> {
    const { bankUrl, blz, loginName, state } = args;
    const lib = await this.lib();
    const config = state.bankingInformation
      ? lib.FinTSConfig.fromBankingInformation(
          FintsClientService.PRODUCT_ID,
          FintsClientService.PRODUCT_VERSION,
          state.bankingInformation,
          loginName,
          state.pin,
          state.tanMethodId,
          state.tanMediaName,
          state.customerId,
        )
      : lib.FinTSConfig.forFirstTimeUse(
          FintsClientService.PRODUCT_ID,
          FintsClientService.PRODUCT_VERSION,
          bankUrl,
          blz,
          loginName,
          state.pin,
          state.customerId,
        );
    return new lib.FinTSClient(config);
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
