import { ForbiddenException } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppAdminGuard } from './app-admin.guard';

function ctxWithRole(role: AppRole | undefined) {
  const req = { user: role ? { sub: 'u1', email: 'x@y', role, type: 'access' } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('AppAdminGuard', () => {
  const guard = new AppAdminGuard();

  it('allows ADMIN', () => {
    expect(guard.canActivate(ctxWithRole(AppRole.ADMIN))).toBe(true);
  });

  it('blocks USER', () => {
    expect(() => guard.canActivate(ctxWithRole(AppRole.USER))).toThrow(ForbiddenException);
  });

  it('blocks unauthenticated', () => {
    expect(() => guard.canActivate(ctxWithRole(undefined))).toThrow(ForbiddenException);
  });
});
