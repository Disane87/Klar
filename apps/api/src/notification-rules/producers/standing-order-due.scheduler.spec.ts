import { describe, it, expect, vi } from 'vitest';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { StandingOrder } from '@prisma/client';
import { StandingOrderDueScheduler } from './standing-order-due.scheduler';
import type { PrismaService } from '../../prisma/prisma.service';
import { RULE_EVENT } from '../events/rule-events';

function makeSO(over: Partial<StandingOrder> = {}): StandingOrder {
  return {
    id: 'so_1',
    householdId: 'hh_1',
    accountId: 'acc_1',
    amountCents: -2500,
    counterpartyName: 'Edeka',
    categoryId: 'cat_food',
    isActive: true,
    nextExpectedAt: new Date('2026-05-28T00:00:00Z'),
    ...over,
  } as StandingOrder;
}

function build() {
  const prisma = {
    standingOrder: { findMany: vi.fn() },
  } as unknown as PrismaService;
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  return { scheduler: new StandingOrderDueScheduler(prisma, events), prisma, events };
}

describe('StandingOrderDueScheduler.scan', () => {
  it('emits one event per due standing order with correct daysUntilDue', async () => {
    const { scheduler, prisma, events } = build();
    vi.mocked(prisma.standingOrder.findMany).mockResolvedValue([
      makeSO({ id: 'so_a', nextExpectedAt: new Date('2026-05-28T00:00:00Z') }),
      makeSO({ id: 'so_b', nextExpectedAt: new Date('2026-05-27T00:00:00Z') }),
    ]);
    const today = new Date('2026-05-27T08:00:00Z');
    const count = await scheduler.scan(today);
    expect(count).toBe(2);
    expect(events.emit).toHaveBeenCalledTimes(2);
    const args = vi.mocked(events.emit).mock.calls;
    expect(args[0][0]).toBe(RULE_EVENT.STANDING_ORDER_DUE);
    const evA = args[0][1] as { fields: { daysUntilDue: number; dueDate: string }; sourceId: string };
    expect(evA.fields.daysUntilDue).toBe(1);
    expect(evA.fields.dueDate).toBe('2026-05-28');
    expect(evA.sourceId).toBe('so_a|2026-05-28');
  });

  it('returns 0 when nothing is due', async () => {
    const { scheduler, prisma, events } = build();
    vi.mocked(prisma.standingOrder.findMany).mockResolvedValue([]);
    const n = await scheduler.scan(new Date('2026-05-27T08:00:00Z'));
    expect(n).toBe(0);
    expect(events.emit).not.toHaveBeenCalled();
  });
});
