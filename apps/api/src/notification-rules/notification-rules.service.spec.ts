import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NotificationRule } from '@prisma/client';
import { NotificationRulesService } from './notification-rules.service';
import type { NotificationRulesRepository } from './notification-rules.repository';
import type { RulesEngineService } from './rules-engine.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';

function makeRule(over: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'nrl_1',
    householdId: 'hh_1',
    userId: 'usr_1',
    name: 'Test',
    enabled: true,
    trigger: 'TRANSACTION_CREATED',
    predicateJson: { op: 'cmp', field: 'amountCents', operator: '>', value: 1000 },
    scheduleJson: null,
    leadTimeDays: null,
    channels: ['IN_APP'],
    digestMode: 'IMMEDIATE',
    cooldownMinutes: null,
    maxPerHour: null,
    maxPerDay: null,
    lastFiredAt: null,
    firedCountToday: 0,
    firedBucketDate: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    ...over,
  } as NotificationRule;
}

function buildService() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    recentFires: vi.fn(),
  } as unknown as NotificationRulesRepository;
  const engine = { dispatchTest: vi.fn().mockResolvedValue(['IN_APP']) } as unknown as RulesEngineService;
  const prisma = {
    transaction: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const scheduled = {
    register: vi.fn(),
    unregister: vi.fn(),
  } as never;
  const aggregations = {
    makeResolver: vi.fn(() => async () => 0),
  } as never;
  const service = new NotificationRulesService(repo, engine, prisma, scheduled, aggregations);
  return { service, repo, engine, prisma, scheduled, aggregations };
}

const ctx: RequestContext = { householdId: 'hh_1', userId: 'usr_1', source: 'web' };

describe('NotificationRulesService.create', () => {
  let svc: ReturnType<typeof buildService>;
  beforeEach(() => {
    svc = buildService();
    vi.mocked(svc.repo.create).mockImplementation(async data => makeRule({
      id: 'nrl_new',
      name: data.name,
      trigger: data.trigger,
      channels: data.channels,
    }));
  });

  it('persists a valid TRANSACTION_CREATED rule', async () => {
    const rule = await svc.service.create(ctx, {
      name: 'Großer Eingang',
      trigger: 'TRANSACTION_CREATED',
      predicate: {
        op: 'cmp',
        field: 'amountCents',
        operator: '>',
        value: 100000,
      },
      channels: ['IN_APP'],
    });
    expect(rule.id).toBe('nrl_new');
    expect(svc.repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'hh_1',
        userId: 'usr_1',
        name: 'Großer Eingang',
        trigger: 'TRANSACTION_CREATED',
      }),
    );
  });

  it('rejects a predicate referencing a field outside the trigger whitelist', async () => {
    await expect(
      svc.service.create(ctx, {
        name: 'bogus',
        trigger: 'TRANSACTION_CREATED',
        predicate: { op: 'cmp', field: 'doesNotExist', operator: '=', value: 'x' },
        channels: ['IN_APP'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an operator not allowed for the field', async () => {
    await expect(
      svc.service.create(ctx, {
        name: 'bad operator',
        trigger: 'TRANSACTION_CREATED',
        predicate: {
          op: 'cmp',
          field: 'amountCents',
          operator: 'contains',
          value: 'x',
        },
        channels: ['IN_APP'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty channels array', async () => {
    await expect(
      svc.service.create(ctx, {
        name: 'no channels',
        trigger: 'TRANSACTION_CREATED',
        predicate: { op: 'cmp', field: 'amountCents', operator: '>', value: 0 },
        channels: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a schedule for SCHEDULED trigger', async () => {
    await expect(
      svc.service.create(ctx, {
        name: 'no schedule',
        trigger: 'SCHEDULED',
        // SCHEDULED has no event-context fields, so use an aggregation value.
        predicate: {
          op: 'cmp',
          field: 'whatever',
          operator: '>',
          value: { aggregation: { type: 'accountBalance', accountId: 'acc_1' } },
        },
        channels: ['IN_APP'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('NotificationRulesService.findOne', () => {
  it('returns the rule when owned by caller', async () => {
    const svc = buildService();
    vi.mocked(svc.repo.findById).mockResolvedValue(makeRule());
    const rule = await svc.service.findOne(ctx, 'nrl_1');
    expect(rule.id).toBe('nrl_1');
  });

  it('404s when the rule belongs to a different user', async () => {
    const svc = buildService();
    vi.mocked(svc.repo.findById).mockResolvedValue(makeRule({ userId: 'usr_other' }));
    await expect(svc.service.findOne(ctx, 'nrl_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the rule does not exist', async () => {
    const svc = buildService();
    vi.mocked(svc.repo.findById).mockResolvedValue(null);
    await expect(svc.service.findOne(ctx, 'nrl_missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('NotificationRulesService.preview', () => {
  it('returns wouldHaveFiredCount=0 for a predicate that matches nothing', async () => {
    const svc = buildService();
    vi.mocked(svc.prisma.transaction.findMany).mockResolvedValue([
      {
        amountCents: 100,
        categoryId: 'cat_1',
        projectId: null,
        accountId: 'acc_1',
        counterparty: 'Lidl',
        description: null,
        bookingText: null,
        transactionKind: null,
        date: new Date('2026-05-01'),
      },
    ] as never);
    const result = await svc.service.preview(ctx, {
      trigger: 'TRANSACTION_CREATED',
      predicate: {
        op: 'cmp',
        field: 'amountCents',
        operator: '>',
        value: 1_000_000,
      },
    });
    expect(result.wouldHaveFiredCount).toBe(0);
    expect(result.sample).toEqual([]);
  });

  it('counts and samples matches', async () => {
    const svc = buildService();
    vi.mocked(svc.prisma.transaction.findMany).mockResolvedValue([
      {
        amountCents: 200000,
        categoryId: 'cat_1',
        projectId: null,
        accountId: 'acc_1',
        counterparty: 'Arbeitgeber GmbH',
        description: null,
        bookingText: null,
        transactionKind: null,
        date: new Date('2026-04-25'),
      },
    ] as never);
    const result = await svc.service.preview(ctx, {
      trigger: 'TRANSACTION_CREATED',
      predicate: { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 },
    });
    expect(result.wouldHaveFiredCount).toBe(1);
    expect(result.sample).toHaveLength(1);
    expect(result.sample[0].title).toBe('Arbeitgeber GmbH');
  });

  it('rejects unsupported triggers in this phase', async () => {
    const svc = buildService();
    await expect(
      svc.service.preview(ctx, {
        trigger: 'BUDGET_THRESHOLD',
        predicate: { op: 'cmp', field: 'usedPct', operator: '>=', value: 80 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('NotificationRulesService.remove', () => {
  it('deletes a rule owned by the caller', async () => {
    const svc = buildService();
    vi.mocked(svc.repo.findById).mockResolvedValue(makeRule());
    vi.mocked(svc.repo.delete).mockResolvedValue(true);
    await svc.service.remove(ctx, 'nrl_1');
    expect(svc.repo.delete).toHaveBeenCalledWith('nrl_1', 'hh_1');
  });

  it('404s on a rule owned by another user', async () => {
    const svc = buildService();
    vi.mocked(svc.repo.findById).mockResolvedValue(makeRule({ userId: 'usr_other' }));
    await expect(svc.service.remove(ctx, 'nrl_1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('NotificationRulesService.test', () => {
  it('hands the rule to the engine for test dispatch', async () => {
    const svc = buildService();
    vi.mocked(svc.repo.findById).mockResolvedValue(makeRule());
    const channels = await svc.service.test(ctx, 'nrl_1');
    expect(channels).toEqual(['IN_APP']);
    expect(svc.engine.dispatchTest).toHaveBeenCalled();
  });
});
