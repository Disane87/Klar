import { describe, it, expect, vi } from 'vitest';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { BudgetThresholdService } from './budget-threshold.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { RULE_EVENT } from '../events/rule-events';

function build() {
  const prisma = {
    budget: { findMany: vi.fn() },
    transaction: { aggregate: vi.fn() },
  } as unknown as PrismaService;
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  return { svc: new BudgetThresholdService(prisma, events), prisma, events };
}

describe('BudgetThresholdService.checkForHouseholdMonth', () => {
  it('emits 50% threshold event when usage just crossed 50%', async () => {
    const { svc, prisma, events } = build();
    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      { id: 'bdg_1', categoryId: 'cat_food', amountCents: 20000 } as never,
    ]);
    // 10500 cents spent → 52.5% (rounded → 52) — crosses 50% threshold.
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amountCents: -10500 },
    } as never);

    await svc.checkForHouseholdMonth('hh_1', '2026-05-15');

    const calls = vi.mocked(events.emit).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toBe(RULE_EVENT.BUDGET_THRESHOLD);
    const payload = calls[0][1] as { fields: { usedPct: number }; sourceId: string };
    expect(payload.fields.usedPct).toBe(53);
    expect(payload.sourceId).toBe('bdg_1|2026-05|50');
  });

  it('emits multiple events when multiple thresholds crossed', async () => {
    const { svc, prisma, events } = build();
    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      { id: 'bdg_1', categoryId: 'cat_food', amountCents: 10000 } as never,
    ]);
    // 13000 → 130% — crosses 50, 80, 100, 120.
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amountCents: -13000 },
    } as never);
    await svc.checkForHouseholdMonth('hh_1', '2026-05-15');
    expect(events.emit).toHaveBeenCalledTimes(4);
  });

  it('skips budgets with non-positive amount', async () => {
    const { svc, prisma, events } = build();
    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      { id: 'bdg_zero', categoryId: 'cat_food', amountCents: 0 } as never,
    ]);
    await svc.checkForHouseholdMonth('hh_1', '2026-05-15');
    expect(events.emit).not.toHaveBeenCalled();
  });
});
