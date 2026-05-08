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
  ) {}

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
      this.logger.debug(
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
        // No TAN method advertised — likely a credentials problem (bank
        // rejected anonymous BPD discovery) or a bank misconfiguration.
        // Surface a real error rather than silently landing on an empty
        // account list.
        const bankErrors = (firstSync.bankAnswers ?? [])
          .filter(a => a.code >= 9000)
          .map(a => `${a.code} ${a.text}`)
          .join(' | ');
        return this.failRun(
          syncRun,
          new Error(
            bankErrors
              ? `Bank lieferte keine TAN-Verfahren — Antwort: ${bankErrors}. Häufig: PIN oder Anmeldename falsch, oder Bank-URL passt nicht zur BLZ.`
              : 'Bank lieferte keine TAN-Verfahren zurück. Bitte PIN, Anmeldename und FinTS-URL prüfen.',
          ),
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
      this.logger.debug(
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

    try {
      const state = this.crypto.decrypt<FintsSessionState>(syncRun.connectionId, {
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
      const resp = await this.client.synchronizeWithTan(fintsClient, tanReference, tan || undefined);
      if (resp.requiresTan) {
        // Bank chained another TAN — re-persist with new reference.
        return this.persistTanChallenge(syncRun, connection, fintsClient, state, resp);
      }

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
      // Setup case: the wizard hasn't picked accounts yet. Status SETUP
      // stays; nothing to ingest. Mark run OK so the wizard can proceed.
      syncRun = await this.syncRuns.update(syncRun.id, {
        status: 'OK',
        finishedAt: new Date(),
        bookingsFetched: 0,
        bookingsImported: 0,
        bookingsSkipped: 0,
      });
      return { syncRun };
    }

    let totalFetched = 0;
    let totalImported = 0;
    let totalSkipped = 0;

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
    };
    // Best-effort: persist BPD changes that may have happened during the
    // partial dialog so a crash before TAN entry doesn't lose them.
    await this.persistSessionState(connection, fintsClient, state);
    await this.connections.setStatus(connection.id, 'TAN_REQUIRED');
    const updated = await this.syncRuns.update(syncRun.id, {
      status: 'TAN_REQUIRED',
      tanChallenge: challenge as unknown as Prisma.InputJsonValue,
    });
    return { syncRun: updated, tanChallenge: challenge };
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

  private async failRun(syncRun: FintsSyncRun, err: unknown): Promise<SyncRunResult> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Sync run ${syncRun.id} failed: ${message}`);
    const finalRun = await this.syncRuns.update(syncRun.id, {
      status: 'FAILED',
      finishedAt: new Date(),
      errorCode: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: message.slice(0, 1000),
    });
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
