import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HouseholdMemberGuard } from './household-member.guard';
import type { HouseholdsRepository } from '../households.repository';
import type { HouseholdMembership } from '@prisma/client';
import { HouseholdRole } from '@prisma/client';

const makeMembership = (): HouseholdMembership => ({
  id: 'mem-1',
  userId: 'u-1',
  householdId: 'h-1',
  role: HouseholdRole.MEMBER,
  joinedAt: new Date(),
});

function makeCtx(overrides: object = {}) {
  const request = {
    user: { sub: 'u-1' },
    params: { hid: 'h-1' },
    reqContext: undefined as unknown,
    ...overrides,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as unknown as import('@nestjs/common').ExecutionContext;
}

const makeRepo = (): HouseholdsRepository =>
  ({ findMembership: vi.fn() }) as unknown as HouseholdsRepository;

describe('HouseholdMemberGuard', () => {
  it('allows access and sets reqContext when user is a member', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findMembership).mockResolvedValue(makeMembership());
    const guard = new HouseholdMemberGuard(repo);
    const ctx = makeCtx();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest() as { reqContext: { householdId: string } };
    expect(req.reqContext.householdId).toBe('h-1');
  });

  it('throws NotFoundException when householdId param is missing', async () => {
    const repo = makeRepo();
    const guard = new HouseholdMemberGuard(repo);
    const ctx = makeCtx({ params: {} });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when user is not a member', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findMembership).mockResolvedValue(null);
    const guard = new HouseholdMemberGuard(repo);
    const ctx = makeCtx();

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
