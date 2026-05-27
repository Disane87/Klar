import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FintsConnection, FintsSyncRun, FintsSyncTrigger, Prisma } from '@prisma/client';
import type { FinTSClient, ClientResponse, Statement, StatementResponse } from 'lib-fints';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportPipelineService } from '../../import-pipeline/import-pipeline.service';
import { FintsClientService } from '../client/fints-client.service';
import { FintsCryptoService } from '../crypto/fints-crypto.service';
import { FintsConnectionRepository } from '../connection/fints-connection.repository';
import { FintsBookingMapper } from '../mapper/fints-booking.mapper';
import { FintsRealtimeService } from '../realtime/fints-realtime.service';
import { FintsSyncRunRepository } from './fints-sync-run.repository';
import type { FintsSessionState } from '../client/fints-session-state';
import { StandingOrdersDetection } from '../../standing-orders/standing-orders.detection';
import { FixedCostsService } from '../../fixed-costs/fixed-costs.service';

export interface StartSyncOptions {
  triggeredBy: FintsSyncTrigger;
  triggeredById?: string | null;
  fromDate?: Date;
  toDate?: Date;
}

export interface SyncRunResult {
  syncRun: FintsSyncRun;
  /** TAN challenge surfaced when the bank demands SCA mid-sync. */
  tanChallenge?: TanChallenge;
}

/**
 * Which lib-fints operation raised the TAN demand. Determines which
 * `*WithTan` resume call {@link FintsSyncService.submitTan} must dispatch:
 *  - `SYNCHRONIZE` → bank wants TAN before releasing BPD/UPD; resume with
 *    `synchronizeWithTan` so the dialog can complete and we get the
 *    account list.
 *  - `STATEMENTS` → bank wants TAN before releasing HKCAZ/HKKAZ booking
 *    data (typical Sparkasse `tanRequiredForStatements`); resume with
 *    `getAccountStatementsWithTan`, otherwise the loop runs `synchronize`
 *    in circles while statements never get fetched.
 */
export type TanOperationContext =
  | { kind: 'SYNCHRONIZE' }
  | { kind: 'STATEMENTS'; accountNumber: string };

export interface TanChallenge {
  tanReference: string;
  prompt: string;
  mediaName?: string;
  /** When the bank ships a chipTAN/photoTAN image, base64-encoded for the modal. */
  mediaBase64?: string;
  mediaMimeType?: string;
  /**
   * True when the bank's selected TAN method is decoupled (pushTAN /
   * banking-app push notification). The wizard hides the TAN-code input
   * and shows a "confirm in your banking app" hint instead.
   */
  isDecoupled: boolean;
  /**
   * Which lib-fints call raised this TAN demand. Persisted so
   * {@link FintsSyncService.submitTan} can dispatch to the matching
   * `*WithTan` resume call instead of always falling back to
   * `synchronizeWithTan`. Optional for backward compatibility with
   * challenges persisted before this field existed — those default to
   * SYNCHRONIZE, which matches the old behaviour.
   */
  operation?: TanOperationContext;
}

/**
 * FinTS sync orchestrator (Phase 14a.7-final).
 *
 * Entry points:
 *   - {@link start}: brand-new sync attempt for a connection. Triggered by
 *     the daily cron (CRON), the manual "sync now" button (MANUAL), or
 *     the setup wizard's first-time call (SETUP).
 *   - {@link submitTan}: resumes an in-flight sync that returned a
 *     `requiresTan` response, with the TAN the user entered (or empty
 *     for decoupled / pushTAN methods).
 *
 * Both paths share a post-auth pipeline that walks every linked Klar
 * account, fetches statements, maps them to RawBookings, and hands them
 * to ImportPipelineService.ingest(). The session-state blob (PIN +
 * BankingInformation) is re-encrypted and persisted after every
 * successful step so the next call short-circuits the BPD discovery.
 *
 * Out-of-scope here: HKSAL balance reconciliation (kept thin in this
 * iteration — drift detection is added in 14a.8 once the UI exists).
 * Out-of-scope: error-class retry policies (handled by the cron caller).
 */
@Injectable()
export class FintsSyncService {
  private readonly logger = new Logger(FintsSyncService.name);

  constructor(
    private readonly connections: FintsConnectionRepository,
    private readonly syncRuns: FintsSyncRunRepository,
    private readonly client: FintsClientService,
    private readonly crypto: FintsCryptoService,
    private readonly pipeline: ImportPipelineService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly realtime: FintsRealtimeService,
    private readonly standingOrders: StandingOrdersDetection,
    private readonly fixedCosts: FixedCostsService,
  ) {}

  /**
   * Tracks the last `tanReference` we emitted on SSE per syncRun so the
   * decoupled auto-poll loop doesn't broadcast a duplicate "tan-required"
   * event on every 2-second status request — only when the bank actually
   * chains a fresh challenge.
   */
  private readonly lastEmittedTanRef = new Map<string, string>();

  /**
   * In-flight decoupled-poll guard. Prevents the wizard's parallel "Fertig"
   * click from spawning a second concurrent poller for the same run.
   */
  private readonly decoupledPolls = new Set<string>();
  private static readonly DECOUPLED_POLL_INTERVAL_MS = 2_000;
  private static readonly DECOUPLED_POLL_TIMEOUT_MS = 2 * 60 * 1000;

  /**
   * Hard cap on TAN-resume calls per sync run. The bank's fraud detection
   * starts locking the online-banking access after a handful of failed
   * or duplicate PIN/TAN messages — and getting unlocked means calling
   * the Berater. Bank-side counters typically reject after 3–5 failed
   * PIN tries, so we stay well below that.
   *
   * This guards against TWO failure modes:
   *   1. A bug like the original SYNCHRONIZE-vs-STATEMENTS-dispatch
   *      mismatch that turns the decoupled poll into an endless loop.
   *   2. A bank that legitimately chains many TAN challenges in one
   *      run (rare, but possible). Five gives us headroom; sixth attempt
   *      fails the run and forces manual intervention.
   */
  private static readonly MAX_TAN_ATTEMPTS = 5;

  /**
   * Hard cap on consecutive HKCAZ chunks per account. Many banks
   * (Sparkasse confirmed) silently truncate a single response to a
   * ~150-day window even when asked for more, so a 15-month sync needs
   * ~3 chunks. We cap well above the realistic worst case to stop a
   * misbehaving bank from running us in circles, while still allowing
   * pulling several years of history when the bank cooperates.
   */
  private static readonly MAX_STATEMENT_CHUNKS = 24;

  /**
   * Bank-side return codes that mean the user's online-banking access
   * is itself in a broken state — re-trying with the same PIN/TAN will
   * not help and may push the account further into a lock. When ANY of
   * these surface, the run fails immediately and the connection is
   * flipped to REAUTH_REQUIRED so no auto-flow can re-issue PIN.
   *
   *   9010 – Initialisierung fehlgeschlagen / PIN/TAN Prüfung fehlgeschlagen
   *   9050 – Die Nachricht enthält Fehler (oft Begleiter von 9010/9933)
   *   9931 – PIN/TAN-Verfahren falsch
   *   9933 – Zugang ist gesperrt (FRAUD-Lockout, Berater anrufen)
   *   3079 – Account-Kombination ungültig (Login-Identifier falsch)
   */
  private static readonly FATAL_AUTH_CODES: ReadonlySet<number> = new Set([
    9010, 9050, 9931, 9933, 3079,
  ]);

  /**
   * Starts a new sync run for the given connection. Returns immediately
   * after either: (a) the bank demanded a TAN, (b) all linked accounts
   * have been ingested, or (c) an error occurred and the run was
   * persisted as FAILED.
   */
  async start(connectionId: string, options: StartSyncOptions): Promise<SyncRunResult> {
    const connection = await this.connections.findById(connectionId);
    if (!connection) {
      throw new NotFoundException(`FinTS connection ${connectionId} not found`);
    }
    if (connection.status === 'REAUTH_REQUIRED') {
      throw new ConflictException('Connection requires fresh SCA — call reauth flow first');
    }

    const fromDate = options.fromDate ?? this.computeFromDate(connection);
    const toDate = options.toDate ?? new Date();

    let syncRun = await this.syncRuns.create({
      connectionId,
      triggeredBy: options.triggeredBy,
      triggeredById: options.triggeredById ?? null,
      fromDate,
      toDate,
    });

    try {
      const state = this.crypto.decrypt<FintsSessionState>(connectionId, {
        cipher: Buffer.from(connection.credentialsCipher),
        iv: Buffer.from(connection.credentialsIv),
        tag: Buffer.from(connection.credentialsTag),
      });

      const fintsClient = await this.client.buildClient({
        bankUrl: connection.serverUrl,
        blz: connection.blz,
        loginName: connection.loginName,
        state,
      });

      // FinTS PIN/TAN setup is a two-pass dialogue (lib-fints/dialog.js
      // line 127-129: HKTAN is only attached when config.selectedTanMethod
      // is set, so the first synchronize() never demands TAN — it can only
      // discover BPD + availableTanMethods anonymously. The second pass,
      // after selectTanMethod(), is the one that triggers SCA and brings
      // back UPD with the account list).
      //
      //   1. synchronize() — fetches BPD + availableTanMethods (no TAN)
      //   2. selectTanMethod() — picks one before any TAN-bearing call
      //   3. synchronize() — now requires TAN that returns UPD
      //   4. synchronizeWithTan() — completes, UPD populated
      const firstSync = await this.client.synchronize(fintsClient);
      this.logger.log(
        `Pass 1 (BPD): bankInfoUpdated=${firstSync.bankingInformationUpdated}, ` +
          `requiresTan=${firstSync.requiresTan}, ` +
          `availableTanMethods=${fintsClient.config.availableTanMethods?.length ?? 0}, ` +
          `bankAnswers=[${(firstSync.bankAnswers ?? []).map(a => `${a.code}:${a.text}`).join(' | ')}]`,
      );
      const firstSyncFatal = this.detectFatalAuthError(firstSync.bankAnswers);
      if (firstSyncFatal) {
        return this.failHardOnAuthError(syncRun, connection.id, firstSyncFatal);
      }
      if (firstSync.requiresTan) {
        // Some banks ask for TAN already on the BPD pass — surface immediately.
        return this.persistTanChallenge(syncRun, connection, fintsClient, state, firstSync);
      }

      const tanMethodIdToUse =
        state.tanMethodId ?? this.pickDefaultTanMethod(fintsClient);
      if (tanMethodIdToUse === null) {
        // No TAN method advertised — most banks reject the dialog at this
        // stage with one of a few well-known codes. We map the most common
        // ones to actionable hints rather than dumping the raw 9xxx text.
        return this.failRun(
          syncRun,
          new Error(this.classifyBankRejection(firstSync.bankAnswers ?? [])),
        );
      }
      if (state.tanMethodId !== tanMethodIdToUse) {
        this.client.selectTanMethod(fintsClient, tanMethodIdToUse);
        state.tanMethodId = tanMethodIdToUse;
      }

      // Persist BPD + chosen method now so a crash before TAN doesn't lose them.
      await this.persistSessionState(connection, fintsClient, state);

      // Pass 2: this call typically demands the TAN that unlocks UPD.
      const secondSync = await this.client.synchronize(fintsClient);
      this.logger.log(
        `Pass 2 (UPD): bankInfoUpdated=${secondSync.bankingInformationUpdated}, ` +
          `requiresTan=${secondSync.requiresTan}, ` +
          `tanReference=${secondSync.tanReference ?? '∅'}, ` +
          `bankAccounts=${fintsClient.config.bankingInformation.upd?.bankAccounts?.length ?? 0}, ` +
          `bankAnswers=[${(secondSync.bankAnswers ?? []).map(a => `${a.code}:${a.text}`).join(' | ')}]`,
      );
      const secondSyncFatal = this.detectFatalAuthError(secondSync.bankAnswers);
      if (secondSyncFatal) {
        return this.failHardOnAuthError(syncRun, connection.id, secondSyncFatal);
      }
      if (secondSync.requiresTan) {
        return this.persistTanChallenge(syncRun, connection, fintsClient, state, secondSync);
      }

      // No TAN demand AND no UPD = something silent went wrong. Don't
      // pretend success — surface to the user with bank's own answer.
      const accountsAfterPass2 =
        fintsClient.config.bankingInformation.upd?.bankAccounts?.length ?? 0;
      if (accountsAfterPass2 === 0) {
        const bankErrors = (secondSync.bankAnswers ?? [])
          .filter(a => a.code >= 9000)
          .map(a => `${a.code} ${a.text}`)
          .join(' | ');
        return this.failRun(
          syncRun,
          new Error(
            bankErrors
              ? `Bank lieferte keine Konten zurück — Antwort: ${bankErrors}.`
              : 'Bank lieferte keine Konten zurück und keine TAN-Anforderung. Bitte mit anderem TAN-Verfahren erneut versuchen oder Bank-Support kontaktieren.',
          ),
        );
      }

      // Persist updated session state and continue ingest.
      await this.persistSessionState(connection, fintsClient, state);
      return this.runIngestPhase(syncRun, connection, fintsClient, state, fromDate, toDate);
    } catch (err) {
      return this.failRun(syncRun, err);
    }
  }

  /**
   * Picks the bank's first advertised TAN method. Returns null when the
   * BPD didn't include any (in which case the bank likely supports a
   * single-step protocol — extremely rare). lib-fints exposes the list
   * after the first synchronize().
   */
  private pickDefaultTanMethod(client: FinTSClient): number | null {
    const methods = client.config.availableTanMethods;
    if (!methods || methods.length === 0) return null;
    return methods[0].id;
  }

  /**
   * Maps the bank's 9xxx error codes to an actionable German message.
   * 9078 = "Banking-Programm ist nicht registriert" — the most common
   * reason FinTS clients fail at first contact: the configured
   * FINTS_PRODUCT_ID is not in the ZKA-Produktregister. Sparkasse and
   * the major Volks-/Genobanks reject every dialog opened with an
   * unregistered ID.
   */
  private classifyBankRejection(
    bankAnswers: ReadonlyArray<{ code: number; text: string }>,
  ): string {
    const codes = new Set(bankAnswers.map(a => a.code));
    const raw = bankAnswers
      .map(a => `${a.code} ${a.text}`)
      .join(' | ');

    if (codes.has(9078) || codes.has(3079)) {
      return (
        'Die FinTS-Produkt-ID dieser Klar-Instanz ist nicht beim ZKA registriert ' +
        '(Bank-Antwort 9078). Bitte FINTS_PRODUCT_ID auf eine registrierte ID setzen — ' +
        'Registrierung kostenlos unter https://www.hbci-zka.de/register/prod_register.htm. ' +
        'Antworten der Bank im Detail: ' + raw
      );
    }
    if (codes.has(9050) || codes.has(9931) || codes.has(9210)) {
      return (
        'Bank hat die Anmeldung abgelehnt — typischerweise PIN, Anmeldename oder Kunden-ID falsch. ' +
        'Bei Sparkasse/Volksbank prüfen, ob du den Anmeldenamen ODER die VR-Kennung verwenden musst. ' +
        'Antworten der Bank: ' + raw
      );
    }
    if (raw) {
      return `Bank hat die Verbindung abgewiesen. Antworten: ${raw}`;
    }
    return 'Bank lieferte keine Antwort. Bitte FinTS-URL und BLZ prüfen.';
  }

  /**
   * Resumes a sync run that returned `requiresTan`. The user provides
   * the TAN (or empty string for decoupled methods); we replay the
   * synchronise call and continue with the ingest phase.
   */
  async submitTan(syncRunId: string, tan: string): Promise<SyncRunResult> {
    let syncRun = await this.syncRuns.findById(syncRunId);
    if (!syncRun) throw new NotFoundException(`Sync run ${syncRunId} not found`);
    if (syncRun.status !== 'TAN_REQUIRED') {
      throw new ConflictException(`Sync run is in status ${syncRun.status}, not TAN_REQUIRED`);
    }
    const connection = await this.connections.findById(syncRun.connectionId);
    if (!connection) throw new NotFoundException(`Connection ${syncRun.connectionId} not found`);

    const challenge = syncRun.tanChallenge as {
      tanReference?: string;
      operation?: TanOperationContext;
    } | null;
    const tanReference = challenge?.tanReference;
    if (!tanReference) {
      throw new BadRequestException('Sync run has no TAN reference — challenge already consumed');
    }
    // Pre-existing challenges without `operation` predate this field — fall
    // back to SYNCHRONIZE, which matches the old (broken-for-STATEMENTS)
    // behaviour but is correct for the only path that previously worked.
    const operation: TanOperationContext = challenge.operation ?? { kind: 'SYNCHRONIZE' };

    // Hard cap on bank-issued TAN rounds (not on submitTan calls — the
    // decoupled poll fires every 2s with the SAME tanReference for code
    // 3956 keep-alives, which must not count). `tanAttempts` is bumped
    // by persistTanChallenge only when the bank chains a NEW reference.
    // Cap exists so a bug that flips the same dialog into a runaway
    // TAN-chain can never re-trigger the fraud-detection that locked
    // the online-banking access once. See FATAL_AUTH_CODES above.
    if (syncRun.tanAttempts >= FintsSyncService.MAX_TAN_ATTEMPTS) {
      return this.failHardOnAuthError(
        syncRun,
        connection.id,
        `TAN-Rounds überschritten (${syncRun.tanAttempts}/${FintsSyncService.MAX_TAN_ATTEMPTS}). ` +
          `Verbindung wird gesperrt, bevor die Bank den Zugang sperrt. Bitte manuell neu einrichten.`,
      );
    }

    // Critical: lib-fints' synchronizeWithTan requires the SAME client
    // instance that returned requiresTan, because the in-flight Dialog
    // (dialogId, lastMessageNumber, …) lives on client.currentDialog and
    // can't be serialised. Building a fresh client here would throw
    // 'no customer dialog was started' inside lib-fints.
    const fintsClient = this.client.getCached(connection.id);
    if (!fintsClient) {
      // Cache expired (10 min) or process restarted between requests.
      // The user has to retry from scratch.
      return this.failRun(
        syncRun,
        new Error(
          'TAN-Bestätigungsfenster abgelaufen (Server-Neustart oder >10 Min seit Setup). ' +
            'Bitte den Setup-Wizard erneut starten.',
        ),
      );
    }

    try {
      const state = this.crypto.decrypt<FintsSessionState>(syncRun.connectionId, {
        cipher: Buffer.from(connection.credentialsCipher),
        iv: Buffer.from(connection.credentialsIv),
        tag: Buffer.from(connection.credentialsTag),
      });

      if (operation.kind === 'STATEMENTS') {
        // The TAN was raised by HKCAZ/HKKAZ (typical Sparkasse
        // `tanRequiredForStatements`). Resume with the matching `*WithTan`
        // call — using `synchronizeWithTan` here makes the bank refresh
        // BPD/UPD and report `requiresTan=false`, but the actual statement
        // fetch never gets the TAN and the next `fetchStatements` raises
        // TAN again, causing a tight decoupled-poll loop.
        const stmtResp = await this.client.fetchStatementsWithTan(
          fintsClient,
          tanReference,
          tan || undefined,
        );
        this.logger.log(
          `submitTan[STATEMENTS ${operation.accountNumber}]: ` +
            `requiresTan=${stmtResp.requiresTan}, ` +
            `statements=${stmtResp.statements?.length ?? 0}, ` +
            `bankAnswers=[${(stmtResp.bankAnswers ?? []).map(a => `${a.code}:${a.text}`).join(' | ')}]`,
        );
        const stmtFatal = this.detectFatalAuthError(stmtResp.bankAnswers);
        if (stmtFatal) {
          return this.failHardOnAuthError(syncRun, connection.id, stmtFatal);
        }
        if (stmtResp.requiresTan) {
          // Bank chained another TAN for the same statement fetch.
          return this.persistTanChallenge(syncRun, connection, fintsClient, state, stmtResp, operation);
        }
        // Statement TAN cleared — hand the already-fetched statements
        // directly to the ingest path so we don't re-issue HKCAZ (which
        // would demand another TAN). Then resume the rest of the linked
        // accounts via runIngestPhase, which skips the account that just
        // succeeded.
        return this.resumeIngestAfterStatementTan(
          syncRun,
          connection,
          fintsClient,
          state,
          operation.accountNumber,
          stmtResp,
        );
      }

      // operation.kind === 'SYNCHRONIZE'
      const resp = await this.client.synchronizeWithTan(fintsClient, tanReference, tan || undefined);
      const accountsAfterTan =
        fintsClient.config.bankingInformation.upd?.bankAccounts?.length ?? 0;
      this.logger.log(
        `submitTan[SYNCHRONIZE]: bankInfoUpdated=${resp.bankingInformationUpdated}, ` +
          `requiresTan=${resp.requiresTan}, ` +
          `bankAccounts=${accountsAfterTan}, ` +
          `bankAnswers=[${(resp.bankAnswers ?? []).map(a => `${a.code}:${a.text}`).join(' | ')}]`,
      );
      const syncFatal = this.detectFatalAuthError(resp.bankAnswers);
      if (syncFatal) {
        return this.failHardOnAuthError(syncRun, connection.id, syncFatal);
      }
      if (resp.requiresTan) {
        // Bank chained another TAN — re-persist with new reference.
        // (rememberForTan is called inside persistTanChallenge.)
        return this.persistTanChallenge(syncRun, connection, fintsClient, state, resp, operation);
      }

      // For first-time setup the response should bring back UPD with the
      // account list. If it doesn't, FAIL loudly rather than land the
      // wizard on a misleading "no accounts" screen with the connection
      // marked OK.
      const isFirstTimeSetup = connection.lastSyncAt === null;
      if (isFirstTimeSetup && accountsAfterTan === 0) {
        this.client.forget(connection.id);
        const bankErrors = (resp.bankAnswers ?? [])
          .map(a => `${a.code} ${a.text}`)
          .join(' | ');
        return this.failRun(
          syncRun,
          new Error(
            'Bank hat die TAN bestätigt, aber keine Konten zurückgeliefert ' +
              `(UPD/HIUPD leer). ${bankErrors ? 'Bank-Antwort: ' + bankErrors + '. ' : ''}` +
              'Häufige Ursache bei Sparkasse: das Online-Banking erlaubt FinTS-Zugriff nicht standardmäßig. ' +
              'Im Online-Banking unter „Online-Banking → Einstellungen" prüfen, ob HBCI/FinTS aktiviert und der Anmeldename ' +
              'als FinTS-Login zugelassen ist.',
          ),
        );
      }

      // Terminal success — drop the cached client now that the dialog is closed.
      this.client.forget(connection.id);
      await this.persistSessionState(connection, fintsClient, state);
      return this.runIngestPhase(
        syncRun,
        connection,
        fintsClient,
        state,
        syncRun.fromDate ?? this.computeFromDate(connection),
        syncRun.toDate ?? new Date(),
      );
    } catch (err) {
      this.client.forget(connection.id);
      return this.failRun(syncRun, err);
    }
  }

  /** Walks every Klar Account linked to this FinTS connection and ingests its statements. */
  private async runIngestPhase(
    syncRun: FintsSyncRun,
    connection: FintsConnection,
    fintsClient: FinTSClient,
    state: FintsSessionState,
    fromDate: Date,
    toDate: Date,
    /**
     * Statements already fetched out-of-band for specific accounts — used
     * by the STATEMENTS-TAN resume path to inject the response from
     * `fetchStatementsWithTan` so we don't re-issue HKCAZ (which would
     * demand a fresh TAN in an endless loop).
     */
    preloadedStatements: Map<string, StatementResponse> = new Map(),
  ): Promise<SyncRunResult> {
    // syncEnabled=false lets users pause individual sub-accounts (e.g. closed
    // savings accounts the bank still advertises in UPD) without archiving
    // them — history stays visible, sync just skips them.
    const linkedAccounts = await this.prisma.account.findMany({
      where: {
        fintsConnectionId: connection.id,
        archivedAt: null,
        syncEnabled: true,
      },
    });
    if (linkedAccounts.length === 0) {
      // Setup case: the wizard hasn't picked accounts yet. Mark run OK so
      // the wizard can render the account picker. Bank-side SCA is fully
      // through at this point, so flip the connection from TAN_REQUIRED
      // straight to ACTIVE — but DO NOT set lastSyncAt; the first real
      // ingest after pickAccounts must use the 90-day default window, not
      // the 2-day overlap heuristic from computeFromDate().
      syncRun = await this.syncRuns.update(syncRun.id, {
        status: 'OK',
        finishedAt: new Date(),
        bookingsFetched: 0,
        bookingsImported: 0,
        bookingsSkipped: 0,
      });
      await this.markConnectionScaCompleted(connection.id);
      this.realtime.emit(syncRun.id, 'ok', { syncRun });
      this.lastEmittedTanRef.delete(syncRun.id);
      return { syncRun };
    }

    let totalFetched = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    // Households touched in this run — we run unified FixedCost detection
    // ONCE per household after all accounts are ingested, since the
    // algorithm operates on the household-wide transaction set.
    const touchedHouseholdIds = new Set<string>();

    this.logger.log(
      `Ingest phase for connection ${connection.id}: ` +
        `fromDate=${fromDate.toISOString().slice(0, 10)}, ` +
        `toDate=${toDate.toISOString().slice(0, 10)}, ` +
        `lastSyncAt=${connection.lastSyncAt?.toISOString() ?? 'null'}, ` +
        `linkedAccounts=${linkedAccounts.length}`,
    );

    for (const account of linkedAccounts) {
      const accountNumber = account.fintsAccountRef;
      if (!accountNumber) {
        this.logger.warn(`Account ${account.id} has no fintsAccountRef — skipping`);
        continue;
      }
      if (!this.client.supportsStatements(fintsClient, accountNumber)) {
        // Bank exposes the account in UPD but doesn't advertise HKCAZ/HKKAZ
        // for it — typical for credit-card or limit/savings sub-accounts.
        // Skip silently per account so the rest of the connection still syncs.
        this.logger.warn(
          `Account ${accountNumber} (${account.id}) does not support statement retrieval (no HKCAZ/HKKAZ) — skipping`,
        );
        continue;
      }
      // Chunking-aware fetch: many German banks (Sparkasse confirmed)
      // silently cap a single HKCAZ response to a fixed window (~150 days
      // from `from`), regardless of the `to` value sent. lib-fints'
      // continuation marker (code 3040) only kicks in when the bank
      // actively signals "more data available" — Sparkasse just stops
      // sending. Result: a 15-month request returns only the first ~5
      // months, no error, no warning.
      //
      // We walk the window forward in chunks. After each response, we
      // find the newest booking-date and re-issue HKCAZ with
      // `from = lastEntry − 2 days` until either:
      //   - we reach `toDate − grace`, or
      //   - the bank returns no new newest-date (stuck — no further data).
      // 2-day overlap covers value-date/booking-date drift so dedup in
      // the ingest pipeline (bankTxId + content hash) eats the dupes.
      const accumulated: Statement[] = [];
      let chunkFrom = fromDate;
      let chunkIndex = 0;
      let lastSeenLatest: string | null = null;
      const preloaded = preloadedStatements.get(accountNumber);
      let preloadedStmts: StatementResponse | undefined = preloaded;
      while (chunkIndex < FintsSyncService.MAX_STATEMENT_CHUNKS) {
        const stmts: StatementResponse = preloadedStmts
          ?? await this.client.fetchStatements(fintsClient, accountNumber, chunkFrom, toDate);
        preloadedStmts = undefined; // only first chunk may be preloaded
        if (stmts.requiresTan) {
          return this.persistTanChallenge(syncRun, connection, fintsClient, state, stmts, {
            kind: 'STATEMENTS',
            accountNumber,
          });
        }

        const stmtCount = stmts.statements?.length ?? 0;
        const chunkDates: string[] = [];
        let chunkEntries = 0;
        for (const s of stmts.statements ?? []) {
          const txs = s.transactions ?? [];
          chunkEntries += txs.length;
          for (const t of txs) {
            const d = t.entryDate ?? t.valueDate;
            if (d) chunkDates.push(d.toISOString().slice(0, 10));
          }
        }
        chunkDates.sort();
        const chunkEarliest = chunkDates[0] ?? '∅';
        const chunkLatest = chunkDates[chunkDates.length - 1] ?? '∅';
        this.logger.log(
          `Account ${accountNumber} chunk ${chunkIndex} ` +
            `[from=${chunkFrom.toISOString().slice(0, 10)} to=${toDate.toISOString().slice(0, 10)}]: ` +
            `bank returned ${stmtCount} statement(s) with ${chunkEntries} entries ` +
            `(booking-date range ${chunkEarliest} … ${chunkLatest})`,
        );

        accumulated.push(...(stmts.statements ?? []));
        chunkIndex++;

        // Decide whether to ask for more. If the bank gave us nothing
        // OR didn't make progress on the date axis, we're done.
        if (!chunkLatest || chunkLatest === '∅') break;
        if (lastSeenLatest === chunkLatest) {
          this.logger.warn(
            `Account ${accountNumber}: bank stuck on ${chunkLatest} — stopping to avoid infinite loop`,
          );
          break;
        }
        lastSeenLatest = chunkLatest;

        const latestDate = new Date(chunkLatest + 'T00:00:00Z');
        // 5-day grace so we don't issue a final 1-chunk for the last few
        // pending-booking days — the daily cron will pick those up tomorrow.
        const reachedTarget = latestDate.getTime() >= toDate.getTime() - 5 * 86_400_000;
        if (reachedTarget) break;

        // Walk forward with a 2-day overlap. Pipeline dedup handles dupes.
        chunkFrom = new Date(latestDate.getTime() - 2 * 86_400_000);
      }
      if (chunkIndex >= FintsSyncService.MAX_STATEMENT_CHUNKS) {
        this.logger.warn(
          `Account ${accountNumber}: hit MAX_STATEMENT_CHUNKS (${FintsSyncService.MAX_STATEMENT_CHUNKS}) — stopping`,
        );
      }

      const totalEntries = accumulated.reduce((n, s) => n + (s.transactions?.length ?? 0), 0);
      const allDates: string[] = [];
      for (const s of accumulated) {
        for (const t of s.transactions ?? []) {
          const d = t.entryDate ?? t.valueDate;
          if (d) allDates.push(d.toISOString().slice(0, 10));
        }
      }
      allDates.sort();
      this.logger.log(
        `Account ${accountNumber}: ${chunkIndex} chunk(s), ${accumulated.length} statement(s), ` +
          `${totalEntries} entries (overall range ${allDates[0] ?? '∅'} … ${allDates[allDates.length - 1] ?? '∅'})`,
      );

      const rawBookings = FintsBookingMapper.toRawBookings(accumulated, {
        iban: account.iban ?? accountNumber,
        syncRunId: syncRun.id,
      });
      totalFetched += rawBookings.length;
      // Cron-driven syncs have a null triggeredById — fall back to the
      // connection owner so PRIVATE-by-default rows aren't orphaned.
      // The Transactions service filters PRIVATE rows by createdByUserId,
      // so without this fallback nobody would see new bookings imported
      // by the daily cron once Visibility defaults to PRIVATE.
      const ingestOwnerId = syncRun.triggeredById ?? connection.ownerId;
      const ingest = await this.pipeline.ingest(rawBookings, {
        householdId: account.householdId,
        accountId: account.id,
        triggeredByUserId: ingestOwnerId,
        source: 'fints',
        fintsSyncRunId: syncRun.id,
      });
      this.logger.log(
        `Account ${accountNumber}: imported=${ingest.imported}, skipped=${ingest.skipped}`,
      );
      totalImported += ingest.imported;
      totalSkipped += ingest.skipped;
      if (ingest.imported > 0) touchedHouseholdIds.add(account.householdId);

      // Persist the latest closing balance the bank shipped — without this
      // the UI falls back to summing all imported transactions, which is
      // the NET DELTA over the synced window, not the actual current
      // balance. lib-fints CAMT statements always include
      // `closingBalance.value` in major units (Euro); pick the latest by
      // balance date across all chunks.
      let latestClosing: { date: Date; cents: number } | null = null;
      for (const s of accumulated) {
        const cb = s.closingBalance;
        if (!cb || typeof cb.value !== 'number' || !cb.date) continue;
        const cents = Math.round(cb.value * 100);
        if (!latestClosing || cb.date.getTime() > latestClosing.date.getTime()) {
          latestClosing = { date: cb.date, cents };
        }
      }
      if (latestClosing) {
        await this.prisma.account.update({
          where: { id: account.id },
          data: {
            lastKnownBalanceCents: latestClosing.cents,
            lastBalanceAt: latestClosing.date,
          },
        });
        this.logger.log(
          `Account ${accountNumber}: persisted closingBalance ${(latestClosing.cents / 100).toFixed(2)}€ ` +
            `as of ${latestClosing.date.toISOString().slice(0, 10)}`,
        );
      }

      try {
        await this.standingOrders.runForAccount({
          householdId: account.householdId,
          accountId: account.id,
        });
      } catch (err) {
        this.logger.warn(
          `Standing-order detection failed for account ${account.id}: ${(err as Error).message}`,
        );
      }
    }

    // Unified FixedCost detection — same algorithm runs after CSV import,
    // FinTS sync, and the manual /recompute endpoint. Only re-run for
    // households that actually received new bookings.
    for (const householdId of touchedHouseholdIds) {
      try {
        await this.fixedCosts.recomputeForHousehold(householdId);
      } catch (err) {
        this.logger.warn(
          `Fixed-cost detection failed for household ${householdId}: ${(err as Error).message}`,
        );
      }
    }

    await this.persistSessionState(connection, fintsClient, state);
    await this.markConnectionSynced(connection.id);

    const finalRun = await this.syncRuns.update(syncRun.id, {
      status: 'OK',
      finishedAt: new Date(),
      bookingsFetched: totalFetched,
      bookingsImported: totalImported,
      bookingsSkipped: totalSkipped,
      tanChallenge: null,
    });
    this.realtime.emit(finalRun.id, 'ok', { syncRun: finalRun });
    this.lastEmittedTanRef.delete(finalRun.id);
    return { syncRun: finalRun };
  }

  /**
   * Continuation point after the user (or decoupled poll) cleared a TAN
   * that was raised by HKCAZ/HKKAZ. The `stmtResp` already contains the
   * just-released bookings for `accountNumber`; we feed them into the
   * standard ingest path through `runIngestPhase` so the rest of the
   * connection's accounts still get synced after.
   */
  private async resumeIngestAfterStatementTan(
    syncRun: FintsSyncRun,
    connection: FintsConnection,
    fintsClient: FinTSClient,
    state: FintsSessionState,
    accountNumber: string,
    stmtResp: StatementResponse,
  ): Promise<SyncRunResult> {
    // Re-enter runIngestPhase with the just-fetched statements pre-loaded
    // for this account — that loop skips the fetchStatements call when it
    // finds a preloaded entry, so no fresh HKCAZ goes out (which would
    // immediately demand another TAN).
    const preload = new Map<string, StatementResponse>();
    preload.set(accountNumber, stmtResp);
    return this.runIngestPhase(
      syncRun,
      connection,
      fintsClient,
      state,
      syncRun.fromDate ?? this.computeFromDate(connection),
      syncRun.toDate ?? new Date(),
      preload,
    );
  }

  private async persistTanChallenge(
    syncRun: FintsSyncRun,
    connection: FintsConnection,
    fintsClient: FinTSClient,
    state: FintsSessionState,
    resp: ClientResponse,
    operation: TanOperationContext = { kind: 'SYNCHRONIZE' },
  ): Promise<SyncRunResult> {
    const challenge: TanChallenge = {
      tanReference: resp.tanReference ?? '',
      prompt: resp.tanChallenge ?? 'TAN erforderlich',
      mediaName: resp.tanMediaName,
      mediaBase64: resp.tanPhoto
        ? Buffer.from(resp.tanPhoto.image).toString('base64')
        : undefined,
      mediaMimeType: resp.tanPhoto?.mimeType,
      isDecoupled: this.client.isSelectedMethodDecoupled(fintsClient),
      operation,
    };
    // Bump the round counter only when the bank actually changed its
    // challenge. The decoupled poll repeatedly funnels the SAME
    // tanReference back through here (code 3956 keep-alive) — those are
    // not new TAN rounds at the bank and must not eat into the cap.
    const previousChallengeRef = (syncRun.tanChallenge as { tanReference?: string } | null)
      ?.tanReference;
    const isNewChallenge = previousChallengeRef !== challenge.tanReference;
    const nextTanAttempts = isNewChallenge ? syncRun.tanAttempts + 1 : syncRun.tanAttempts;
    if (isNewChallenge && nextTanAttempts > FintsSyncService.MAX_TAN_ATTEMPTS) {
      // Bank is chaining TAN demands beyond the cap — bail out before
      // we approach the fraud-lockout threshold. (Real worst-case: a
      // bank legitimately needs >5 rounds; user must re-run setup.)
      return this.failHardOnAuthError(
        syncRun,
        connection.id,
        `Bank fordert zu viele TAN-Rounds (${nextTanAttempts}/${FintsSyncService.MAX_TAN_ATTEMPTS}). ` +
          `Verbindung wird gesperrt, bevor die Bank den Zugang sperrt.`,
      );
    }

    // Best-effort: persist BPD changes that may have happened during the
    // partial dialog so a crash before TAN entry doesn't lose them.
    await this.persistSessionState(connection, fintsClient, state);
    await this.connections.setStatus(connection.id, 'TAN_REQUIRED');
    // Keep this exact FinTSClient instance for submitTan — lib-fints
    // stores the in-flight Dialog state on the client and a fresh
    // instance can't continue with synchronizeWithTan.
    this.client.rememberForTan(connection.id, fintsClient);
    const updated = await this.syncRuns.update(syncRun.id, {
      status: 'TAN_REQUIRED',
      tanChallenge: challenge as unknown as Prisma.InputJsonValue,
      tanAttempts: nextTanAttempts,
    });

    // Emit on SSE only when the challenge actually changed: lib-fints
    // returns the SAME tanReference for every "still pending" status reply
    // (return code 3956), and we'd otherwise spam the wizard with redundant
    // tan-required events every 2 seconds.
    const previousRef = this.lastEmittedTanRef.get(syncRun.id);
    if (previousRef !== challenge.tanReference) {
      this.lastEmittedTanRef.set(syncRun.id, challenge.tanReference);
      this.realtime.emit(syncRun.id, 'tan-required', {
        syncRun: updated,
        tanChallenge: challenge,
      });
    }

    // Decoupled / pushTAN: kick off a background poll that calls
    // synchronizeWithTan(empty) every 2s for up to 2min, so the wizard
    // auto-progresses as soon as the user confirms in the banking app.
    if (challenge.isDecoupled) {
      void this.startDecoupledPoll(syncRun.id);
    }

    return { syncRun: updated, tanChallenge: challenge };
  }

  /**
   * Background loop for decoupled (pushTAN) confirmation. Calls
   * {@link submitTan} with an empty TAN every 2 seconds; lib-fints' library
   * translates that into the bank's HKTAN status request. The bank replies
   *   - 3956 ("still pending") → another `requiresTan` with the same
   *     reference; we keep polling
   *   - success → run advances to ingest, emits 'ok'
   *   - any 9xxx → run advances to FAILED, emits 'failed'
   * On timeout we mark the run FAILED so the wizard can show a meaningful
   * message instead of dangling on the "Bestätigung in deiner App" hint.
   */
  private async startDecoupledPoll(syncRunId: string): Promise<void> {
    if (this.decoupledPolls.has(syncRunId)) return;
    this.decoupledPolls.add(syncRunId);
    const deadline = Date.now() + FintsSyncService.DECOUPLED_POLL_TIMEOUT_MS;
    try {
      while (Date.now() < deadline) {
        await new Promise(resolve =>
          setTimeout(resolve, FintsSyncService.DECOUPLED_POLL_INTERVAL_MS),
        );
        const fresh = await this.syncRuns.findById(syncRunId);
        if (!fresh) return;
        if (fresh.status !== 'TAN_REQUIRED') return; // terminal or aborted
        const challenge = fresh.tanChallenge as { isDecoupled?: boolean } | null;
        if (!challenge?.isDecoupled) return; // chained to non-decoupled — user must enter TAN
        try {
          const result = await this.submitTan(syncRunId, '');
          // submitTan emits its own events. If still TAN_REQUIRED with a
          // decoupled challenge, the next iteration continues polling.
          if (result.syncRun.status !== 'TAN_REQUIRED') return;
          if (result.tanChallenge && !result.tanChallenge.isDecoupled) return;
        } catch (err) {
          this.logger.warn(
            `Decoupled auto-poll for sync run ${syncRunId} aborted: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return;
        }
      }
      // Hit the timeout without bank confirmation.
      const stillPending = await this.syncRuns.findById(syncRunId);
      if (stillPending?.status === 'TAN_REQUIRED') {
        this.client.forget(stillPending.connectionId);
        await this.failRun(
          stillPending,
          new Error(
            'Bestätigung in der Banking-App nicht innerhalb von 2 Minuten erfolgt. ' +
              'Bitte den Setup-Wizard erneut starten.',
          ),
        );
      }
    } finally {
      this.decoupledPolls.delete(syncRunId);
    }
  }

  private async persistSessionState(
    connection: FintsConnection,
    fintsClient: FinTSClient,
    base: FintsSessionState,
  ): Promise<void> {
    const fresh = this.client.extractSessionState(fintsClient, base);
    const capabilities = this.client.extractCapabilities(fintsClient);

    // Capabilities are not secret — write them even when the crypto
    // master-key isn't configured (tests + bare dev runs). Session
    // state needs encryption, so its update is gated below.
    await this.prisma.fintsConnection.update({
      where: { id: connection.id },
      data: { capabilitiesJson: capabilities as unknown as Prisma.InputJsonValue },
    });

    if (!this.crypto.isReady()) return; // Tests + dev without master key
    const sealed = this.crypto.encrypt(connection.id, fresh);
    await this.prisma.fintsConnection.update({
      where: { id: connection.id },
      data: {
        credentialsCipher: new Uint8Array(sealed.cipher),
        credentialsIv: new Uint8Array(sealed.iv),
        credentialsTag: new Uint8Array(sealed.tag),
      },
    });
  }

  private async markConnectionSynced(connectionId: string): Promise<void> {
    const now = new Date();
    const scaWindow = this.config.get<number>('fints.scaWindowDays') ?? 89;
    await this.prisma.fintsConnection.update({
      where: { id: connectionId },
      data: {
        status: 'ACTIVE',
        lastSyncAt: now,
        lastSyncStatus: 'OK',
        lastScaAt: now,
        scaExpiresAt: new Date(now.getTime() + scaWindow * 86_400_000),
      },
    });
  }

  /**
   * Setup-only counterpart of {@link markConnectionSynced}: SCA succeeded
   * but no Klar accounts are linked yet, so no bookings were fetched. We
   * still want the connection out of TAN_REQUIRED (so the bank list stops
   * showing the red banner) — but lastSyncAt must remain null so the next
   * ingest gets the full 90-day backfill instead of a 2-day overlap.
   */
  private async markConnectionScaCompleted(connectionId: string): Promise<void> {
    const now = new Date();
    const scaWindow = this.config.get<number>('fints.scaWindowDays') ?? 89;
    await this.prisma.fintsConnection.update({
      where: { id: connectionId },
      data: {
        status: 'ACTIVE',
        lastScaAt: now,
        scaExpiresAt: new Date(now.getTime() + scaWindow * 86_400_000),
      },
    });
  }

  /**
   * Inspects bank answers for codes that indicate auth itself is in a
   * broken state. Returns a human-readable summary when one is found;
   * null otherwise. Used by {@link guardFatalAuthOrThrow} to decide
   * whether to fail-hard a sync run.
   */
  private detectFatalAuthError(
    answers: ReadonlyArray<{ code: number; text: string }> | undefined,
  ): string | null {
    if (!answers || answers.length === 0) return null;
    const fatal = answers.filter(a => FintsSyncService.FATAL_AUTH_CODES.has(a.code));
    if (fatal.length === 0) return null;
    return fatal.map(a => `${a.code} ${a.text}`).join(' | ');
  }

  /**
   * Centralised fatal-auth abort path. Locks the connection out of all
   * future auto-flows (cron + manual button refuse REAUTH_REQUIRED in
   * {@link FintsService.triggerSync}) and forgets the cached client so
   * no in-flight TAN can be replayed. The user must explicitly re-auth
   * via the setup wizard before another PIN goes to the bank.
   */
  private async failHardOnAuthError(
    syncRun: FintsSyncRun,
    connectionId: string,
    reason: string,
  ): Promise<SyncRunResult> {
    this.logger.error(
      `Fatal auth error on connection ${connectionId} — locking REAUTH_REQUIRED: ${reason}`,
    );
    this.client.forget(connectionId);
    await this.connections.setStatus(connectionId, 'REAUTH_REQUIRED').catch(err => {
      this.logger.warn(
        `Could not flip connection ${connectionId} to REAUTH_REQUIRED: ${(err as Error).message}`,
      );
    });
    return this.failRun(
      syncRun,
      new Error(
        `Bank-Auth abgelehnt — Verbindung gesperrt, manuelle Re-Authentifizierung nötig. ` +
          `Antworten: ${reason}`,
      ),
    );
  }

  private async failRun(syncRun: FintsSyncRun, err: unknown): Promise<SyncRunResult> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Sync run ${syncRun.id} failed: ${message}`);
    const finalRun = await this.syncRuns.update(syncRun.id, {
      status: 'FAILED',
      finishedAt: new Date(),
      errorCode: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: message.slice(0, 1000),
    });
    this.realtime.emit(finalRun.id, 'failed', { syncRun: finalRun });
    this.lastEmittedTanRef.delete(finalRun.id);

    // Orphan cleanup: when the very first sync of a brand-new connection
    // fails (status still SETUP), nuke the FintsConnection so the user
    // can retry from a clean slate without manually deleting via the UI.
    // Cascade-delete also clears this syncRun + sibling runs from the
    // FintsSyncRun table.
    const connection = await this.connections.findById(syncRun.connectionId);
    if (connection?.status === 'SETUP') {
      // Drop any cached client for this connection — its FinTSClient state
      // is irrelevant once the connection itself is gone.
      this.client.forget(connection.id);
      try {
        await this.prisma.fintsConnection.delete({ where: { id: connection.id } });
        this.logger.log(
          `Removed orphan SETUP-state FinTS connection ${connection.id} after failed first sync`,
        );
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to clean up orphan connection ${connection.id}: ${cleanupErr}`,
        );
      }
    }

    return { syncRun: finalRun };
  }

  /**
   * Window heuristic: 2-day overlap with the previous sync to catch
   * postings the bank backdates; 90 days for first-time-use as the
   * upstream default. The dedup hash makes overlap safe.
   */
  private computeFromDate(connection: FintsConnection): Date {
    if (connection.lastSyncAt) {
      return new Date(connection.lastSyncAt.getTime() - 2 * 86_400_000);
    }
    return new Date(Date.now() - 90 * 86_400_000);
  }
}
