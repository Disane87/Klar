import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { FintsConnection, FintsSyncRun, Account } from '@prisma/client';

/** A connection enriched with the Klar Account rows linked via fintsConnectionId. */
export type ConnectionWithAccounts = FintsConnection & { accounts: Account[] };
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { RequestContext } from '../common/types/request-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { FintsConnectionRepository } from './connection/fints-connection.repository';
import { FintsSyncRunRepository } from './sync/fints-sync-run.repository';
import { FintsSyncService, type TanChallenge } from './sync/fints-sync.service';
import { FintsCryptoService } from './crypto/fints-crypto.service';
import { FintsRealtimeService, type FintsRunEvent } from './realtime/fints-realtime.service';
import { BankRegistryService } from './banks/bank-registry.service';
import type { FintsSessionState } from './client/fints-session-state';
import type { FintsCapabilities } from './capabilities/fints-capabilities';

export interface CreateConnectionInput {
  bankName: string;
  blz: string;
  serverUrl: string;
  loginName: string;
  pin: string;
  customerId?: string;
}

export interface PickAccountsInput {
  accounts: Array<{
    /** lib-fints' accountNumber (from discovered-accounts response). */
    fintsAccountRef: string;
    /** Display name in Klar. Defaults to "<BankName> · <accountNumber>". */
    name?: string;
    iban?: string;
    bic?: string;
    visibility?: 'SHARED' | 'PRIVATE';
  }>;
}

/**
 * User-facing FinTS service (Phase 14a.6 backend).
 *
 * Responsibilities:
 *   - bank lookup proxy (delegates to BankRegistryService)
 *   - connection CRUD with owner-only write rules
 *   - delegating sync triggers + TAN submission to FintsSyncService
 *   - account-picker step that links lib-fints sub-accounts to Klar
 *     Account rows
 *
 * Read access scopes by household membership (the controller guard).
 * Write access on a connection (sync trigger excepted) requires owner.
 */
@Injectable()
export class FintsService {
  /**
   * Sync rate-limit per connection — guards against accidental double-clicks
   * and runaway loops. Banks rate-limit at the seconds level, not minutes,
   * so 30s is plenty. We further skip the cooldown when the previous run
   * ended in FAILED so the user can immediately retry after a hiccup.
   */
  private static readonly SYNC_COOLDOWN_MS = 30 * 1000;

  constructor(
    private readonly connections: FintsConnectionRepository,
    private readonly syncRuns: FintsSyncRunRepository,
    private readonly sync: FintsSyncService,
    private readonly crypto: FintsCryptoService,
    private readonly registry: BankRegistryService,
    private readonly prisma: PrismaService,
    private readonly realtime: FintsRealtimeService,
  ) {}

  /**
   * Authorises and returns the SSE event stream for a sync run. The wizard
   * subscribes after `POST /connections` returns a decoupled tanChallenge
   * and gets `ok` / `failed` pushed as soon as the bank confirms the push
   * notification — no manual "Fertig" click required.
   */
  async streamSyncRunEvents(
    ctx: RequestContext,
    syncRunId: string,
  ): Promise<Observable<MessageEvent>> {
    const run = await this.syncRuns.findById(syncRunId);
    if (!run) throw new NotFoundException(`Sync run ${syncRunId} not found`);
    const connection = await this.connections.findById(run.connectionId);
    if (!connection || connection.householdId !== ctx.householdId) {
      throw new NotFoundException(`Sync run ${syncRunId} not found`);
    }
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the connection owner can subscribe to sync events');
    }
    return this.realtime.stream(syncRunId).pipe(
      map((event: FintsRunEvent) => ({ data: event } as MessageEvent)),
    );
  }

  /** Public BLZ lookup for the setup wizard. */
  lookupBank(blz: string) {
    return this.registry.lookup(blz);
  }

  /** Full searchable bank list for the setup wizard's combobox. */
  listBanks() {
    return this.registry.listFintsCapable();
  }

  async list(ctx: RequestContext): Promise<ConnectionWithAccounts[]> {
    const items = await this.prisma.fintsConnection.findMany({
      where: { householdId: ctx.householdId },
      orderBy: { createdAt: 'desc' },
      include: {
        accounts: {
          where: { archivedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });

    // Fall-back saldo: when HKSAL hasn't reported a real balance yet,
    // compute one from the running sum of imported bookings so the bank
    // list and account rows show *something* meaningful instead of "—".
    // We only override `lastKnownBalanceCents` for accounts where it's
    // currently null — never replace an authoritative HKSAL value.
    const accountIdsNeedingFallback = items
      .flatMap(c => c.accounts)
      .filter(a => a.lastKnownBalanceCents === null || a.lastKnownBalanceCents === undefined)
      .map(a => a.id);
    if (accountIdsNeedingFallback.length > 0) {
      const sums = await this.prisma.transaction.groupBy({
        by: ['accountId'],
        where: {
          householdId: ctx.householdId,
          accountId: { in: accountIdsNeedingFallback },
        },
        _sum: { amountCents: true },
      });
      const sumByAccount = new Map<string, number>(
        sums.map(s => [s.accountId, s._sum.amountCents ?? 0]),
      );
      for (const c of items) {
        for (const a of c.accounts) {
          if (a.lastKnownBalanceCents !== null && a.lastKnownBalanceCents !== undefined) {
            continue;
          }
          const sum = sumByAccount.get(a.id);
          if (sum !== undefined) {
            // Mutating the in-memory Account row only — DB stays untouched
            // so HKSAL can later overwrite without conflict resolution.
            a.lastKnownBalanceCents = sum;
          }
        }
      }
    }

    // Dedupe heal: a previously buggy wizard path could attach two Account
    // rows for the same fintsAccountRef. Collapse them — keep the oldest
    // (createdAt asc), re-point transactions to it, archive the rest.
    // Runs once per dupe; subsequent list() calls are a no-op.
    for (const c of items) {
      const refGroups = new Map<string, typeof c.accounts>();
      for (const a of c.accounts) {
        if (!a.fintsAccountRef) continue;
        const arr = refGroups.get(a.fintsAccountRef) ?? [];
        arr.push(a);
        refGroups.set(a.fintsAccountRef, arr);
      }
      for (const [, group] of refGroups) {
        if (group.length <= 1) continue;
        group.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
        const [keep, ...dupes] = group;
        const dupeIds = dupes.map(d => d.id);
        await this.prisma.transaction.updateMany({
          where: { accountId: { in: dupeIds } },
          data: { accountId: keep.id },
        });
        await this.prisma.account.updateMany({
          where: { id: { in: dupeIds } },
          data: {
            archivedAt: new Date(),
            fintsConnectionId: null,
            fintsAccountRef: null,
          },
        });
        // Refresh the in-memory snapshot so the response immediately
        // reflects the dedup result.
        c.accounts = c.accounts.filter(a => !dupeIds.includes(a.id));
      }
    }

    // Defensive auto-heal: any connection stuck in TAN_REQUIRED that
    // already has linked Klar accounts must have completed SCA — the
    // bank's UPD couldn't have produced sub-accounts otherwise. Without
    // this, the bank list shows a red "TAN ERFORDERLICH" banner forever
    // until the user triggers a manual sync (which would re-prompt for
    // a TAN they don't owe).
    const result: ConnectionWithAccounts[] = [];
    for (const c of items) {
      if (c.status === 'TAN_REQUIRED' && c.accounts.length > 0) {
        const now = new Date();
        const scaWindow = 89;
        const updated = await this.prisma.fintsConnection.update({
          where: { id: c.id },
          data: {
            status: 'ACTIVE',
            lastScaAt: c.lastScaAt ?? now,
            scaExpiresAt:
              c.scaExpiresAt ?? new Date(now.getTime() + scaWindow * 86_400_000),
          },
        });
        result.push({ ...updated, accounts: c.accounts });
      } else {
        result.push(c);
      }
    }
    return result;
  }

  async findOne(ctx: RequestContext, id: string): Promise<FintsConnection> {
    const c = await this.connections.findById(id);
    if (!c || c.householdId !== ctx.householdId) {
      throw new NotFoundException(`FinTS connection ${id} not found`);
    }
    return c;
  }

  /**
   * Returns the bank-advertised statement-fetch capabilities cached on
   * the connection (refreshed after every successful sync). Returns the
   * neutral-defaults projection when the connection has not yet been
   * synced — `extractedAt` is null in that case so the wizard can
   * fall back to safe presets.
   */
  async getCapabilities(
    ctx: RequestContext,
    id: string,
  ): Promise<FintsCapabilities> {
    const c = await this.findOne(ctx, id);
    const cached = c.capabilitiesJson as unknown as FintsCapabilities | null;
    if (cached && typeof cached === 'object') return cached;
    return {
      maxLookbackDays: null,
      supportsHKCAZ: false,
      supportsHKKAZ: false,
      tanRequiredForStatements: false,
      extractedAt: null,
    };
  }

  async create(
    ctx: RequestContext,
    input: CreateConnectionInput,
  ): Promise<{ connection: FintsConnection; syncRun: FintsSyncRun; tanChallenge?: TanChallenge }> {
    if (!this.crypto.isReady()) {
      throw new BadRequestException(
        'FinTS encryption is not configured (FINTS_MASTER_KEY missing)',
      );
    }

    // Persist a placeholder connection first so we have an id to bind
    // the AAD and the sync run to.
    const placeholderState: FintsSessionState = { pin: input.pin, customerId: input.customerId };

    // Two-step create: insert with empty cipher, then update with the
    // sealed credentials once we know the row's id (id-bound AAD).
    // Unique constraint on (ownerId, blz, loginName) catches anything
    // that slips past the FE inflight-guard.
    let stub;
    try {
      stub = await this.prisma.fintsConnection.create({
        data: {
          ownerId: ctx.userId,
          householdId: ctx.householdId,
          bankName: input.bankName,
          blz: input.blz,
          serverUrl: input.serverUrl,
          loginName: input.loginName,
          credentialsCipher: new Uint8Array(),
          credentialsIv: new Uint8Array(),
          credentialsTag: new Uint8Array(),
          status: 'SETUP',
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'FINTS_CONNECTION_DUPLICATE',
          message:
            'Eine Verbindung zu dieser Bank mit demselben Login existiert bereits. Bitte zuerst die bestehende Verbindung löschen.',
        });
      }
      throw err;
    }
    const sealed = this.crypto.encrypt(stub.id, placeholderState);
    const connection = await this.prisma.fintsConnection.update({
      where: { id: stub.id },
      data: {
        credentialsCipher: new Uint8Array(sealed.cipher),
        credentialsIv: new Uint8Array(sealed.iv),
        credentialsTag: new Uint8Array(sealed.tag),
      },
    });

    // Zero the plaintext PIN buffer in memory (best-effort).
    placeholderState.pin = '';

    const result = await this.sync.start(connection.id, {
      triggeredBy: 'SETUP',
      triggeredById: ctx.userId,
    });
    return {
      connection,
      syncRun: result.syncRun,
      tanChallenge: result.tanChallenge,
    };
  }

  async triggerSync(
    ctx: RequestContext,
    id: string,
    options: { fromDate?: Date; toDate?: Date } = {},
  ): Promise<{ syncRun: FintsSyncRun; tanChallenge?: TanChallenge }> {
    const connection = await this.findOne(ctx, id);
    if (connection.status === 'REAUTH_REQUIRED') {
      throw new ConflictException({ code: 'REAUTH_REQUIRED', message: 'TAN-Re-Auth nötig' });
    }
    const lastRun = await this.syncRuns.findMostRecent(id);
    const recent = lastRun && Date.now() - lastRun.startedAt.getTime() < FintsService.SYNC_COOLDOWN_MS;
    // Failed runs don't count toward the cooldown — the user typically
    // wants to retry immediately after fixing whatever broke (PIN, network).
    if (recent && lastRun.status !== 'FAILED') {
      throw new ConflictException({
        code: 'SYNC_RATE_LIMIT',
        message: 'Bitte ein paar Sekunden warten — der letzte Sync läuft noch oder ist gerade durch.',
      });
    }
    return this.sync.start(id, {
      triggeredBy: 'MANUAL',
      triggeredById: ctx.userId,
      fromDate: options.fromDate,
      toDate: options.toDate,
    });
  }

  async submitTan(
    ctx: RequestContext,
    syncRunId: string,
    tan: string,
  ): Promise<{ syncRun: FintsSyncRun; tanChallenge?: TanChallenge }> {
    const run = await this.syncRuns.findById(syncRunId);
    if (!run) throw new NotFoundException(`Sync run ${syncRunId} not found`);
    const connection = await this.connections.findById(run.connectionId);
    if (!connection || connection.householdId !== ctx.householdId) {
      throw new NotFoundException(`Sync run ${syncRunId} not found`);
    }
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the connection owner can submit a TAN');
    }
    return this.sync.submitTan(syncRunId, tan);
  }

  /**
   * Returns the lib-fints-discovered sub-account list straight from the
   * connection's persisted BankingInformation. The setup wizard renders
   * this list for the user to pick which sub-accounts to attach.
   */
  async listDiscoveredAccounts(ctx: RequestContext, id: string) {
    const connection = await this.findOne(ctx, id);
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the owner can view discovered accounts');
    }
    if (!this.crypto.isReady()) {
      throw new BadRequestException('FinTS encryption not configured');
    }
    const state = this.crypto.decrypt<FintsSessionState>(connection.id, {
      cipher: Buffer.from(connection.credentialsCipher),
      iv: Buffer.from(connection.credentialsIv),
      tag: Buffer.from(connection.credentialsTag),
    });
    return state.bankingInformation?.upd?.bankAccounts ?? [];
  }

  async pickAccounts(
    ctx: RequestContext,
    id: string,
    input: PickAccountsInput,
  ): Promise<Account[]> {
    const connection = await this.findOne(ctx, id);
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the owner can attach FinTS accounts');
    }
    if (!Array.isArray(input.accounts) || input.accounts.length === 0) {
      throw new BadRequestException('At least one account must be selected');
    }
    // Idempotency guard: re-running pickAccounts (wizard retried, double
    // submission, race) must not create duplicate Account rows for the
    // same FinTS sub-account. We look up what's already there for this
    // connection and skip refs the user already picked.
    const existing = await this.prisma.account.findMany({
      where: {
        fintsConnectionId: connection.id,
        archivedAt: null,
      },
    });
    const alreadyLinked = new Set(
      existing
        .map(a => a.fintsAccountRef)
        .filter((r): r is string => !!r),
    );

    const created: Account[] = [];
    for (const a of input.accounts) {
      if (alreadyLinked.has(a.fintsAccountRef)) {
        const reused = existing.find(e => e.fintsAccountRef === a.fintsAccountRef);
        if (reused) created.push(reused);
        continue;
      }
      const acc = await this.prisma.account.create({
        data: {
          householdId: ctx.householdId,
          ownerId: ctx.userId,
          name: a.name ?? `${connection.bankName} · ${a.fintsAccountRef}`,
          type: 'fints',
          currency: 'EUR',
          iban: a.iban ?? null,
          bic: a.bic ?? null,
          visibility: a.visibility ?? 'SHARED',
          fintsConnectionId: connection.id,
          fintsAccountRef: a.fintsAccountRef,
        },
      });
      created.push(acc);
    }

    // Heal any connection that came out of the wizard still flagged
    // TAN_REQUIRED — by the time accounts can be picked, SCA is provably
    // through (UPD with bankAccounts came back). The connection-list
    // banner would otherwise stay red until the next manual sync.
    if (connection.status === 'TAN_REQUIRED' || connection.status === 'SETUP') {
      const now = new Date();
      const scaWindow = 89;
      await this.prisma.fintsConnection.update({
        where: { id: connection.id },
        data: {
          status: 'ACTIVE',
          lastScaAt: connection.lastScaAt ?? now,
          scaExpiresAt:
            connection.scaExpiresAt ?? new Date(now.getTime() + scaWindow * 86_400_000),
        },
      });
    }

    return created;
  }

  /**
   * Counts the rows that {@link remove} would destroy: linked FinTS accounts
   * plus their transactions and standing orders. Used by the UI to render a
   * concrete confirmation prompt ("3 accounts, 412 transactions, …").
   */
  async getDeleteImpact(
    ctx: RequestContext,
    id: string,
  ): Promise<{ accounts: number; transactions: number; standingOrders: number }> {
    const connection = await this.findOne(ctx, id);
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException(
        'Only the owner can inspect deletion impact for this connection',
      );
    }
    const accountIds = await this.prisma.account.findMany({
      where: { fintsConnectionId: id, type: 'fints' },
      select: { id: true },
    });
    if (accountIds.length === 0) {
      return { accounts: 0, transactions: 0, standingOrders: 0 };
    }
    const ids = accountIds.map((a) => a.id);
    const [transactions, standingOrders] = await Promise.all([
      this.prisma.transaction.count({ where: { accountId: { in: ids } } }),
      this.prisma.standingOrder.count({ where: { accountId: { in: ids } } }),
    ]);
    return { accounts: accountIds.length, transactions, standingOrders };
  }

  /**
   * Update per-connection sync settings (Phase 8). Only the owner may
   * change them. Recomputes nextSyncAt from the new interval so the
   * change takes effect on the next master tick.
   */
  async updateSyncSettings(
    ctx: RequestContext,
    id: string,
    update: {
      syncInterval?: 'MANUAL' | 'H4' | 'H6' | 'H12' | 'H24' | 'H48' | 'H168';
      syncEnabled?: boolean;
    },
  ): Promise<FintsConnection> {
    const connection = await this.findOne(ctx, id);
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the owner can change sync settings');
    }
    return this.connections.setSyncInterval(
      id,
      update.syncInterval ?? connection.syncInterval,
      update.syncEnabled ?? connection.syncEnabled,
    );
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const connection = await this.findOne(ctx, id);
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the owner can delete this connection');
    }
    // Cascade is intentional: when the user removes a bank we also drop every
    // FinTS-typed account linked to it plus the imported history (transactions
    // and standing orders). The Account.fintsConnectionId FK is onDelete=
    // SetNull, so we must do this explicitly. csv_only / manual accounts that
    // happen to share the FK are left untouched (defense in depth).
    const fintsAccounts = await this.prisma.account.findMany({
      where: { fintsConnectionId: id, type: 'fints' },
      select: { id: true },
    });
    const accountIds = fintsAccounts.map((a) => a.id);

    await this.prisma.$transaction(async (tx) => {
      if (accountIds.length > 0) {
        await tx.transaction.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.standingOrder.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.account.deleteMany({ where: { id: { in: accountIds } } });
      }
      // Overwrite cipher columns with random bytes before deletion so a
      // subsequent backup-restore cannot accidentally resurrect the PIN.
      await tx.fintsConnection.update({
        where: { id },
        data: {
          credentialsCipher: new Uint8Array(crypto.getRandomValues(new Uint8Array(64))),
          credentialsIv: new Uint8Array(crypto.getRandomValues(new Uint8Array(12))),
          credentialsTag: new Uint8Array(crypto.getRandomValues(new Uint8Array(16))),
        },
      });
      await tx.fintsConnection.delete({ where: { id } });
    });
  }

  toResponse(c: FintsConnection | ConnectionWithAccounts) {
    const accounts = 'accounts' in c && Array.isArray(c.accounts)
      ? c.accounts.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          iban: a.iban,
          bic: a.bic,
          fintsAccountRef: a.fintsAccountRef,
          lastKnownBalanceCents: a.lastKnownBalanceCents,
          lastBalanceAt: a.lastBalanceAt?.toISOString() ?? null,
          syncEnabled: a.syncEnabled,
        }))
      : [];
    return {
      id: c.id,
      ownerId: c.ownerId,
      householdId: c.householdId,
      bankName: c.bankName,
      blz: c.blz,
      loginName: c.loginName,
      status: c.status,
      lastScaAt: c.lastScaAt?.toISOString() ?? null,
      scaExpiresAt: c.scaExpiresAt?.toISOString() ?? null,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: c.lastSyncStatus,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      accounts,
    };
  }

  toSyncRunResponse(r: FintsSyncRun) {
    return {
      id: r.id,
      connectionId: r.connectionId,
      status: r.status,
      triggeredBy: r.triggeredBy,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      bookingsFetched: r.bookingsFetched,
      bookingsImported: r.bookingsImported,
      bookingsSkipped: r.bookingsSkipped,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
    };
  }
}
