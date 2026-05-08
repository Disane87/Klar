import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FintsConnection, FintsSyncRun, FintsSyncTrigger, Prisma } from '@prisma/client';
import type { FinTSClient, ClientResponse } from 'lib-fints';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportPipelineService } from '../../import-pipeline/import-pipeline.service';
import { FintsClientService } from '../client/fints-client.service';
import { FintsCryptoService } from '../crypto/fints-crypto.service';
import { FintsConnectionRepository } from '../connection/fints-connection.repository';
import { FintsBookingMapper } from '../mapper/fints-booking.mapper';
import { FintsRealtimeService } from '../realtime/fints-realtime.service';
import { FintsSyncRunRepository } from './fints-sync-run.repository';
import type { FintsSessionState } from '../client/fints-session-state';

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

    const challenge = syncRun.tanChallenge as { tanReference?: string } | null;
    const tanReference = challenge?.tanReference;
    if (!tanReference) {
      throw new BadRequestException('Sync run has no TAN reference — challenge already consumed');
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
      const resp = await this.client.synchronizeWithTan(fintsClient, tanReference, tan || undefined);
      const accountsAfterTan =
        fintsClient.config.bankingInformation.upd?.bankAccounts?.length ?? 0;
      this.logger.log(
        `submitTan: bankInfoUpdated=${resp.bankingInformationUpdated}, ` +
          `requiresTan=${resp.requiresTan}, ` +
          `bankAccounts=${accountsAfterTan}, ` +
          `bankAnswers=[${(resp.bankAnswers ?? []).map(a => `${a.code}:${a.text}`).join(' | ')}]`,
      );
      if (resp.requiresTan) {
        // Bank chained another TAN — re-persist with new reference.
        // (rememberForTan is called inside persistTanChallenge.)
        return this.persistTanChallenge(syncRun, connection, fintsClient, state, resp);
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
  ): Promise<SyncRunResult> {
    const linkedAccounts = await this.prisma.account.findMany({
      where: { fintsConnectionId: connection.id, archivedAt: null },
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
      const stmts = await this.client.fetchStatements(fintsClient, accountNumber, fromDate, toDate);
      if (stmts.requiresTan) {
        return this.persistTanChallenge(syncRun, connection, fintsClient, state, stmts);
      }
      const stmtCount = stmts.statements?.length ?? 0;
      // Inspect what the bank actually returned: which booking-date range is
      // covered, how many entries per statement. Lets us tell apart bank-side
      // truncation from a too-narrow request window.
      const bookingDates: string[] = [];
      let totalEntries = 0;
      for (const s of stmts.statements ?? []) {
        const entries = (s as { entries?: unknown[] }).entries ?? [];
        totalEntries += entries.length;
        for (const e of entries as Array<{ valueDate?: Date; bookingDate?: Date }>) {
          const d = e.bookingDate ?? e.valueDate;
          if (d) bookingDates.push(d.toISOString().slice(0, 10));
        }
      }
      bookingDates.sort();
      const earliest = bookingDates[0] ?? '∅';
      const latest = bookingDates[bookingDates.length - 1] ?? '∅';
      this.logger.log(
        `Account ${accountNumber}: bank returned ${stmtCount} statement(s) ` +
          `with ${totalEntries} entries (booking-date range ${earliest} … ${latest})`,
      );

      const rawBookings = FintsBookingMapper.toRawBookings(stmts.statements, {
        iban: account.iban ?? accountNumber,
        syncRunId: syncRun.id,
      });
      totalFetched += rawBookings.length;
      const ingest = await this.pipeline.ingest(rawBookings, {
        householdId: account.householdId,
        accountId: account.id,
        triggeredByUserId: syncRun.triggeredById,
        source: 'fints',
        fintsSyncRunId: syncRun.id,
      });
      this.logger.log(
        `Account ${accountNumber}: imported=${ingest.imported}, skipped=${ingest.skipped}`,
      );
      totalImported += ingest.imported;
      totalSkipped += ingest.skipped;
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

  private async persistTanChallenge(
    syncRun: FintsSyncRun,
    connection: FintsConnection,
    fintsClient: FinTSClient,
    state: FintsSessionState,
    resp: ClientResponse,
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
    };
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
