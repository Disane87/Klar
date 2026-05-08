import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { FintsConnection, FintsSyncRun, Account } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { FintsConnectionRepository } from './connection/fints-connection.repository';
import { FintsSyncRunRepository } from './sync/fints-sync-run.repository';
import { FintsSyncService, type TanChallenge } from './sync/fints-sync.service';
import { FintsCryptoService } from './crypto/fints-crypto.service';
import { BankRegistryService } from './banks/bank-registry.service';
import type { FintsSessionState } from './client/fints-session-state';

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
  /** Sync rate-limit per connection — protects banks from us. */
  private static readonly SYNC_COOLDOWN_MS = 5 * 60 * 1000;

  constructor(
    private readonly connections: FintsConnectionRepository,
    private readonly syncRuns: FintsSyncRunRepository,
    private readonly sync: FintsSyncService,
    private readonly crypto: FintsCryptoService,
    private readonly registry: BankRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  /** Public BLZ lookup for the setup wizard. */
  lookupBank(blz: string) {
    return this.registry.lookup(blz);
  }

  /** Full searchable bank list for the setup wizard's combobox. */
  listBanks() {
    return this.registry.listFintsCapable();
  }

  async list(ctx: RequestContext): Promise<FintsConnection[]> {
    return this.prisma.fintsConnection.findMany({
      where: { householdId: ctx.householdId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: RequestContext, id: string): Promise<FintsConnection> {
    const c = await this.connections.findById(id);
    if (!c || c.householdId !== ctx.householdId) {
      throw new NotFoundException(`FinTS connection ${id} not found`);
    }
    return c;
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
    const stub = await this.prisma.fintsConnection.create({
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
  ): Promise<{ syncRun: FintsSyncRun; tanChallenge?: TanChallenge }> {
    const connection = await this.findOne(ctx, id);
    if (connection.status === 'REAUTH_REQUIRED') {
      throw new ConflictException({ code: 'REAUTH_REQUIRED', message: 'TAN-Re-Auth nötig' });
    }
    const lastRun = await this.syncRuns.findMostRecent(id);
    if (lastRun && Date.now() - lastRun.startedAt.getTime() < FintsService.SYNC_COOLDOWN_MS) {
      throw new ConflictException({
        code: 'SYNC_RATE_LIMIT',
        message: 'Letzter Sync ist weniger als 5 Minuten her',
      });
    }
    return this.sync.start(id, { triggeredBy: 'MANUAL', triggeredById: ctx.userId });
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
    const created: Account[] = [];
    for (const a of input.accounts) {
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
    return created;
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const connection = await this.findOne(ctx, id);
    if (connection.ownerId !== ctx.userId) {
      throw new ForbiddenException('Only the owner can delete this connection');
    }
    // Overwrite cipher columns with random bytes before deletion so a
    // subsequent backup-restore cannot accidentally resurrect the PIN.
    await this.prisma.fintsConnection.update({
      where: { id },
      data: {
        credentialsCipher: new Uint8Array(crypto.getRandomValues(new Uint8Array(64))),
        credentialsIv: new Uint8Array(crypto.getRandomValues(new Uint8Array(12))),
        credentialsTag: new Uint8Array(crypto.getRandomValues(new Uint8Array(16))),
      },
    });
    await this.prisma.fintsConnection.delete({ where: { id } });
  }

  toResponse(c: FintsConnection) {
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
