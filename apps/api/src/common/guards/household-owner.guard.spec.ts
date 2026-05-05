import { ForbiddenException } from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdOwnerGuard } from './household-owner.guard';
import type { HouseholdsRepository } from '../../households/households.repository';

function makeCtx(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('HouseholdOwnerGuard', () => {
  let repo: HouseholdsRepository;
  let guard: HouseholdOwnerGuard;

  beforeEach(() => {
    repo = { findMembership: vi.fn() } as unknown as HouseholdsRepository;
    guard = new HouseholdOwnerGuard(repo);
  });

  it('allows OWNER', async () => {
    (repo.findMembership as ReturnType<typeof vi.fn>).mockResolvedValue({ role: HouseholdRole.OWNER });
    const req: Record<string, unknown> = { user: { sub: 'u1' }, params: { hid: 'h1' } };
    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req['reqContext']).toMatchObject({ userId: 'u1', householdId: 'h1', source: 'web' });
  });

  it('blocks MEMBER', async () => {
    (repo.findMembership as ReturnType<typeof vi.fn>).mockResolvedValue({ role: HouseholdRole.MEMBER });
    const req = { user: { sub: 'u1' }, params: { hid: 'h1' } };
    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(ForbiddenException);
  });

  it('blocks non-members', async () => {
    (repo.findMembership as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = { user: { sub: 'u1' }, params: { hid: 'h1' } };
    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(ForbiddenException);
  });
});
