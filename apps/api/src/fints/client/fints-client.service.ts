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
import { APP_VERSION } from '../../common/app-version';

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
interface CachedClient {
  client: FinTSClient;
  expiresAt: number;
}

@Injectable()
export class FintsClientService {
  /** Klar's product registration data. ZKA-issued IDs go in env when we apply. */
  private static readonly PRODUCT_ID =
    process.env['FINTS_PRODUCT_ID'] ?? 'klar-dev';
  // ZKA FinTS field "Produktversion" is AN..5 — `1.20.2` would overflow.
  // Strip dots and clamp so the value stays valid across all releases.
  private static readonly PRODUCT_VERSION = APP_VERSION.replace(/\./g, '').slice(0, 5);

  /** TAN reflection window: how long we keep the FinTSClient alive after a
   *  synchronize() that returned requiresTan. lib-fints' continuation
   *  (`synchronizeWithTan`) needs `currentDialog` from the same client
   *  instance — a fresh client throws "no customer dialog was started". */
  private static readonly CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;

  private readonly logger = new Logger(FintsClientService.name);
  private libPromise: Promise<LibFintsModule> | null = null;
  private readonly cache = new Map<string, CachedClient>();

  /** Loads lib-fints once, lazily, and caches the module. */
  private lib(): Promise<LibFintsModule> {
    if (!this.libPromise) {
      this.libPromise = loadLibFints();
    }
    return this.libPromise;
  }

  /**
   * Stash a FinTSClient instance for in-flight TAN-continuation.
   * synchronizeWithTan / *WithTan calls require the same instance because
   * lib-fints stores the dialog state in client.currentDialog.
   */
  rememberForTan(connectionId: string, client: FinTSClient): void {
    this.cleanupExpired();
    this.cache.set(connectionId, {
      client,
      expiresAt: Date.now() + FintsClientService.CLIENT_CACHE_TTL_MS,
    });
  }

  /** Returns a cached client when still alive, otherwise null. */
  getCached(connectionId: string): FinTSClient | null {
    const entry = this.cache.get(connectionId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(connectionId);
      return null;
    }
    return entry.client;
  }

  /** Drops the cached client — call on terminal state (OK / FAILED). */
  forget(connectionId: string): void {
    this.cache.delete(connectionId);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) this.cache.delete(id);
    }
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
   * Whether the bank's currently-selected TAN method is decoupled
   * (pushTAN/banking-app push notification — no code-input required).
   * The wizard needs this so it can render a spinner instead of the
   * 6-digit input field.
   */
  isSelectedMethodDecoupled(client: FinTSClient): boolean {
    return client.config.selectedTanMethod?.isDecoupled ?? false;
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

  /**
   * Whether the bank advertises any statement-fetching capability (CAMT
   * `HKCAZ` or MT940 `HKKAZ`) for this account. Credit-card and certain
   * limit/savings sub-accounts in a FinTS connection only expose balance
   * (`HKSAL`) — calling `getAccountStatements` on them throws.
   */
  supportsStatements(client: FinTSClient, accountNumber: string): boolean {
    const cfg = client.config;
    return (
      cfg.isAccountTransactionSupported(accountNumber, 'HKCAZ') ||
      cfg.isAccountTransactionSupported(accountNumber, 'HKKAZ')
    );
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
