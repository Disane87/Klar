import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { FintsService } from './fints.service';
import { FintsRealtimeService } from './realtime/fints-realtime.service';
import type { FintsConnectionRepository } from './connection/fints-connection.repository';
import type { FintsSyncRunRepository } from './sync/fints-sync-run.repository';
import type { FintsSyncService } from './sync/fints-sync.service';
import type { FintsCryptoService } from './crypto/fints-crypto.service';
import type { BankRegistryService } from './banks/bank-registry.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';

function buildService(overrides: {
  syncRuns?: Partial<FintsSyncRunRepository>;
  connections?: Partial<FintsConnectionRepository>;
  realtime?: FintsRealtimeService;
  registry?: Partial<BankRegistryService>;
  prisma?: unknown;
} = {}): FintsService {
  const realtime = overrides.realtime ?? new FintsRealtimeService();
  return new FintsService(
    {
      findById: vi.fn(),
      ...overrides.connections,
    } as unknown as FintsConnectionRepository,
    {
      findById: vi.fn(),
      ...overrides.syncRuns,
    } as unknown as FintsSyncRunRepository,
    {} as FintsSyncService,
    {} as FintsCryptoService,
    {
      lookup: vi.fn(),
      listFintsCapable: vi.fn(),
      ...overrides.registry,
    } as unknown as BankRegistryService,
    (overrides.prisma ?? {}) as unknown as PrismaService,
    realtime,
  );
}

const ctx: RequestContext = {
  userId: 'user-1',
  householdId: 'hh-1',
  scopes: [],
} as unknown as RequestContext;

describe('FintsService.list auto-heal', () => {
  it('flips TAN_REQUIRED → ACTIVE when the connection already has linked accounts', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'c1',
        householdId: 'hh-1',
        ownerId: 'user-1',
        status: 'TAN_REQUIRED',
        lastScaAt: null,
        scaExpiresAt: null,
        accounts: [{ id: 'a1', lastKnownBalanceCents: 12345 }],
      },
    ]);
    const update = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'c1',
      householdId: 'hh-1',
      ownerId: 'user-1',
      status: data.status,
      lastScaAt: data.lastScaAt,
      scaExpiresAt: data.scaExpiresAt,
    }));
    const svc = buildService({
      prisma: {
        fintsConnection: { findMany, update },
        transaction: { groupBy: vi.fn().mockResolvedValue([]) },
      },
    });
    const result = await svc.list(ctx);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result[0].status).toBe('ACTIVE');
    expect(result[0].lastScaAt).toBeInstanceOf(Date);
    expect(result[0].scaExpiresAt).toBeInstanceOf(Date);
  });

  it('preserves an existing lastScaAt when healing a stuck connection', async () => {
    const existingScaAt = new Date('2026-04-01T00:00:00Z');
    const existingExpiresAt = new Date('2026-06-29T00:00:00Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'c3',
        status: 'TAN_REQUIRED',
        lastScaAt: existingScaAt,
        scaExpiresAt: existingExpiresAt,
        accounts: [
          { id: 'a1', lastKnownBalanceCents: 100 },
          { id: 'a2', lastKnownBalanceCents: 200 },
        ],
      },
    ]);
    const update = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'c3',
      status: data.status,
      lastScaAt: data.lastScaAt,
      scaExpiresAt: data.scaExpiresAt,
    }));
    const svc = buildService({
      prisma: {
        fintsConnection: { findMany, update },
        transaction: { groupBy: vi.fn().mockResolvedValue([]) },
      },
    });
    const result = await svc.list(ctx);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result[0].lastScaAt).toEqual(existingScaAt);
    expect(result[0].scaExpiresAt).toEqual(existingExpiresAt);
  });

  it('fills lastKnownBalanceCents from the running booking sum when HKSAL is missing', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'c1',
        status: 'ACTIVE',
        accounts: [
          { id: 'a1', lastKnownBalanceCents: null },
          { id: 'a2', lastKnownBalanceCents: 99999 },
        ],
      },
    ]);
    const groupBy = vi.fn().mockResolvedValue([
      { accountId: 'a1', _sum: { amountCents: 4250 } },
    ]);
    const svc = buildService({
      prisma: {
        fintsConnection: { findMany, update: vi.fn() },
        transaction: { groupBy },
      },
    });
    const result = await svc.list(ctx);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: { in: ['a1'] },
        }),
      }),
    );
    expect(result[0].accounts[0].lastKnownBalanceCents).toBe(4250);
    // Authoritative HKSAL value on a2 must NOT be overwritten.
    expect(result[0].accounts[1].lastKnownBalanceCents).toBe(99999);
  });

  it('leaves TAN_REQUIRED untouched when no accounts have been picked yet', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'c2',
        status: 'TAN_REQUIRED',
        accounts: [],
      },
    ]);
    const update = vi.fn();
    const svc = buildService({
      prisma: {
        fintsConnection: { findMany, update },
        transaction: { groupBy: vi.fn().mockResolvedValue([]) },
      },
    });
    const result = await svc.list(ctx);
    expect(update).not.toHaveBeenCalled();
    expect(result[0].status).toBe('TAN_REQUIRED');
    expect(result[0].accounts).toEqual([]);
  });
});

describe('FintsService.pickAccounts', () => {
  it('flips a TAN_REQUIRED connection to ACTIVE after the user picks accounts', async () => {
    const connection = {
      id: 'c1',
      bankName: 'Sparkasse',
      ownerId: 'user-1',
      householdId: 'hh-1',
      status: 'TAN_REQUIRED',
      lastScaAt: null,
      scaExpiresAt: null,
    };
    const accountCreate = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'acc-1',
      ...data,
    }));
    const connectionUpdate = vi.fn().mockResolvedValue({});
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue(connection),
      },
      prisma: {
        fintsConnection: { update: connectionUpdate },
        account: { create: accountCreate, findMany: vi.fn().mockResolvedValue([]) },
      },
    });

    const result = await svc.pickAccounts(ctx, 'c1', {
      accounts: [{ fintsAccountRef: '1234567890' }],
    });
    expect(result).toHaveLength(1);
    expect(connectionUpdate).toHaveBeenCalledTimes(1);
    expect(connectionUpdate.mock.calls[0][0].data.status).toBe('ACTIVE');
  });
});

describe('FintsService.triggerSync cooldown', () => {
  it('rejects when the last successful run was within the cooldown', async () => {
    const startMock = vi.fn();
    const svc = buildService({
      connections: {
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'c1', householdId: 'hh-1', status: 'ACTIVE' }),
      },
      syncRuns: {
        findMostRecent: vi
          .fn()
          .mockResolvedValue({ id: 'r0', status: 'OK', startedAt: new Date() }),
      },
    });
    (svc as unknown as { sync: { start: typeof startMock } }).sync = { start: startMock };
    await expect(svc.triggerSync(ctx, 'c1')).rejects.toMatchObject({
      response: { code: 'SYNC_RATE_LIMIT' },
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  it('allows immediate retry when the previous run failed', async () => {
    const startMock = vi.fn().mockResolvedValue({ syncRun: { id: 'r1' } });
    const svc = buildService({
      connections: {
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'c1', householdId: 'hh-1', status: 'ACTIVE' }),
      },
      syncRuns: {
        findMostRecent: vi
          .fn()
          .mockResolvedValue({ id: 'r0', status: 'FAILED', startedAt: new Date() }),
      },
    });
    (svc as unknown as { sync: { start: typeof startMock } }).sync = { start: startMock };
    await svc.triggerSync(ctx, 'c1');
    expect(startMock).toHaveBeenCalledOnce();
  });

  it('rejects when the connection is REAUTH_REQUIRED', async () => {
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          status: 'REAUTH_REQUIRED',
        }),
      },
    });
    await expect(svc.triggerSync(ctx, 'c1')).rejects.toMatchObject({
      response: { code: 'REAUTH_REQUIRED' },
    });
  });
});

describe('FintsService bank lookup pass-through', () => {
  it('delegates lookupBank to the registry', () => {
    const lookup = vi.fn().mockReturnValue({ found: true });
    const listFintsCapable = vi.fn().mockReturnValue([]);
    const svc = buildService({ registry: { lookup, listFintsCapable } });
    const result = svc.lookupBank('37050198');
    expect(lookup).toHaveBeenCalledWith('37050198');
    expect(result).toEqual({ found: true });
    expect(svc.listBanks()).toEqual([]);
    expect(listFintsCapable).toHaveBeenCalled();
  });
});

describe('FintsService.streamSyncRunEvents', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('throws NotFoundException when the sync run is unknown', async () => {
    const svc = buildService({
      syncRuns: { findById: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.streamSyncRunEvents(ctx, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFoundException when the connection belongs to another household', async () => {
    const svc = buildService({
      syncRuns: {
        findById: vi.fn().mockResolvedValue({ id: 'r1', connectionId: 'c1' }),
      },
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-OTHER',
          ownerId: 'user-1',
        }),
      },
    });
    await expect(svc.streamSyncRunEvents(ctx, 'r1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when the caller is not the connection owner', async () => {
    const svc = buildService({
      syncRuns: {
        findById: vi.fn().mockResolvedValue({ id: 'r1', connectionId: 'c1' }),
      },
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'user-2',
        }),
      },
    });
    await expect(svc.streamSyncRunEvents(ctx, 'r1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns an SSE-shaped MessageEvent observable for the owner', async () => {
    const realtime = new FintsRealtimeService();
    const svc = buildService({
      realtime,
      syncRuns: {
        findById: vi.fn().mockResolvedValue({ id: 'r1', connectionId: 'c1' }),
      },
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'user-1',
        }),
      },
    });
    const stream$ = await svc.streamSyncRunEvents(ctx, 'r1');
    realtime.emit('r1', 'ok', { foo: 'bar' });
    const message = await firstValueFrom(stream$);
    expect(message).toEqual({
      data: { type: 'ok', syncRunId: 'r1', data: { foo: 'bar' } },
    });
  });
});

describe('FintsService.getDeleteImpact', () => {
  it('returns counts of fints accounts, transactions, standing orders for owner', async () => {
    const accountFindMany = vi.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    const txCount = vi.fn().mockResolvedValue(412);
    const soCount = vi.fn().mockResolvedValue(7);
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'user-1',
        }),
      },
      prisma: {
        account: { findMany: accountFindMany },
        transaction: { count: txCount },
        standingOrder: { count: soCount },
      },
    });
    const impact = await svc.getDeleteImpact(ctx, 'c1');
    expect(impact).toEqual({ accounts: 2, transactions: 412, standingOrders: 7 });
    expect(accountFindMany).toHaveBeenCalledWith({
      where: { fintsConnectionId: 'c1', type: 'fints' },
      select: { id: true },
    });
    expect(txCount).toHaveBeenCalledWith({ where: { accountId: { in: ['a1', 'a2'] } } });
    expect(soCount).toHaveBeenCalledWith({ where: { accountId: { in: ['a1', 'a2'] } } });
  });

  it('short-circuits to zeros when no accounts are linked', async () => {
    const txCount = vi.fn();
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'user-1',
        }),
      },
      prisma: {
        account: { findMany: vi.fn().mockResolvedValue([]) },
        transaction: { count: txCount },
        standingOrder: { count: vi.fn() },
      },
    });
    const impact = await svc.getDeleteImpact(ctx, 'c1');
    expect(impact).toEqual({ accounts: 0, transactions: 0, standingOrders: 0 });
    expect(txCount).not.toHaveBeenCalled();
  });

  it('rejects non-owner with ForbiddenException', async () => {
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'someone-else',
        }),
      },
      prisma: {
        account: { findMany: vi.fn() },
        transaction: { count: vi.fn() },
        standingOrder: { count: vi.fn() },
      },
    });
    await expect(svc.getDeleteImpact(ctx, 'c1')).rejects.toThrow(ForbiddenException);
  });
});

describe('FintsService.remove cascade', () => {
  it('deletes fints accounts + their transactions and standing orders, then the connection', async () => {
    const accountFindMany = vi.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    const txDeleteMany = vi.fn().mockResolvedValue({ count: 412 });
    const soDeleteMany = vi.fn().mockResolvedValue({ count: 5 });
    const accDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const connUpdate = vi.fn().mockResolvedValue({});
    const connDelete = vi.fn().mockResolvedValue({});
    // $transaction(callback) executes callback with a tx client. We pass the
    // same prisma stub through so deleteMany/update/delete calls land on it.
    const tx = {
      transaction: { deleteMany: txDeleteMany },
      standingOrder: { deleteMany: soDeleteMany },
      account: { deleteMany: accDeleteMany },
      fintsConnection: { update: connUpdate, delete: connDelete },
    };
    const $transaction = vi.fn().mockImplementation(async (cb) => cb(tx));

    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'user-1',
        }),
      },
      prisma: {
        account: { findMany: accountFindMany },
        $transaction,
      },
    });

    await svc.remove(ctx, 'c1');

    expect(accountFindMany).toHaveBeenCalledWith({
      where: { fintsConnectionId: 'c1', type: 'fints' },
      select: { id: true },
    });
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { accountId: { in: ['a1', 'a2'] } },
    });
    expect(soDeleteMany).toHaveBeenCalledWith({
      where: { accountId: { in: ['a1', 'a2'] } },
    });
    expect(accDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1', 'a2'] } },
    });
    expect(connUpdate).toHaveBeenCalled();
    expect(connDelete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('skips account/transaction deletes when no fints accounts are linked', async () => {
    const txDeleteMany = vi.fn();
    const accDeleteMany = vi.fn();
    const connDelete = vi.fn().mockResolvedValue({});
    const tx = {
      transaction: { deleteMany: txDeleteMany },
      standingOrder: { deleteMany: vi.fn() },
      account: { deleteMany: accDeleteMany },
      fintsConnection: { update: vi.fn().mockResolvedValue({}), delete: connDelete },
    };
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'user-1',
        }),
      },
      prisma: {
        account: { findMany: vi.fn().mockResolvedValue([]) },
        $transaction: vi.fn().mockImplementation(async (cb) => cb(tx)),
      },
    });
    await svc.remove(ctx, 'c1');
    expect(txDeleteMany).not.toHaveBeenCalled();
    expect(accDeleteMany).not.toHaveBeenCalled();
    expect(connDelete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('rejects non-owner with ForbiddenException and does not touch prisma', async () => {
    const $transaction = vi.fn();
    const svc = buildService({
      connections: {
        findById: vi.fn().mockResolvedValue({
          id: 'c1',
          householdId: 'hh-1',
          ownerId: 'someone-else',
        }),
      },
      prisma: {
        account: { findMany: vi.fn() },
        $transaction,
      },
    });
    await expect(svc.remove(ctx, 'c1')).rejects.toThrow(ForbiddenException);
    expect($transaction).not.toHaveBeenCalled();
  });
});
