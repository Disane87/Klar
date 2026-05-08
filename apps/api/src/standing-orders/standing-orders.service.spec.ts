import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StandingOrdersService } from './standing-orders.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';

const ctx = { userId: 'u1', householdId: 'h1', source: 'web' } as RequestContext;

function makePrisma() {
  return {
    standingOrder: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaService;
}

describe('StandingOrdersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: StandingOrdersService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new StandingOrdersService(prisma);
  });

  it('lists by householdId, defaults to active-only', async () => {
    (prisma.standingOrder.findMany as any).mockResolvedValue([]);
    await svc.list(ctx, { includeInactive: false });
    expect(prisma.standingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: 'h1', isActive: true }),
      }),
    );
  });

  it('lists includes inactive when requested', async () => {
    (prisma.standingOrder.findMany as any).mockResolvedValue([]);
    await svc.list(ctx, { includeInactive: true });
    const call = (prisma.standingOrder.findMany as any).mock.calls[0][0];
    expect(call.where.householdId).toBe('h1');
    expect(call.where).not.toHaveProperty('isActive');
  });

  it('creates a manual standing order with source=MANUAL', async () => {
    (prisma.standingOrder.create as any).mockResolvedValue({ id: 'so1' });
    await svc.create(ctx, {
      accountId: 'a1',
      counterpartyName: 'Test',
      amountCents: -1000,
      frequency: 'MONTHLY',
    });
    expect(prisma.standingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'MANUAL',
          householdId: 'h1',
          accountId: 'a1',
          amountCents: -1000,
          frequency: 'MONTHLY',
          groupKey: expect.stringMatching(/^manual:/),
        }),
      }),
    );
  });

  it('rejects bank-field update on FINTS_DERIVED', async () => {
    (prisma.standingOrder.findUnique as any).mockResolvedValue({
      id: 'so1', householdId: 'h1', source: 'FINTS_DERIVED',
    });
    await expect(
      svc.update(ctx, 'so1', { amountCents: -2000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts user-field update on FINTS_DERIVED', async () => {
    (prisma.standingOrder.findUnique as any).mockResolvedValue({
      id: 'so1', householdId: 'h1', source: 'FINTS_DERIVED',
    });
    (prisma.standingOrder.update as any).mockResolvedValue({ id: 'so1', note: 'hi' });
    const res = await svc.update(ctx, 'so1', {
      note: 'hi',
      categoryId: 'c1',
      isActive: false,
    });
    expect(res.id).toBe('so1');
  });

  it('accepts bank-field update on MANUAL', async () => {
    (prisma.standingOrder.findUnique as any).mockResolvedValue({
      id: 'so1', householdId: 'h1', source: 'MANUAL',
    });
    (prisma.standingOrder.update as any).mockResolvedValue({ id: 'so1' });
    const res = await svc.update(ctx, 'so1', { amountCents: -5000 });
    expect(res.id).toBe('so1');
  });

  it('rejects delete on FINTS_DERIVED', async () => {
    (prisma.standingOrder.findUnique as any).mockResolvedValue({
      id: 'so1', householdId: 'h1', source: 'FINTS_DERIVED',
    });
    await expect(svc.remove(ctx, 'so1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows delete on MANUAL', async () => {
    (prisma.standingOrder.findUnique as any).mockResolvedValue({
      id: 'so1', householdId: 'h1', source: 'MANUAL',
    });
    (prisma.standingOrder.delete as any).mockResolvedValue({ id: 'so1' });
    await expect(svc.remove(ctx, 'so1')).resolves.toBeUndefined();
  });

  it('rejects access to other household', async () => {
    (prisma.standingOrder.findUnique as any).mockResolvedValue({
      id: 'so1', householdId: 'OTHER', source: 'MANUAL',
    });
    await expect(
      svc.update(ctx, 'so1', { note: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
