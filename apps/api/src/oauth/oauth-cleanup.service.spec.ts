import { describe, it, expect, vi } from 'vitest';
import { OAuthCleanupService } from './oauth-cleanup.service';
import type { OAuthRepository } from './oauth.repository';

describe('OAuthCleanupService.runCleanup', () => {
  it('deletes expired codes and stale revoked grants', async () => {
    const repo = {
      deleteExpiredAuthCodes: vi.fn().mockResolvedValue({ count: 3 }),
      deleteExpiredGrants: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const svc = new OAuthCleanupService(repo as unknown as OAuthRepository);
    const result = await svc.runCleanup();
    expect(result).toEqual({ codes: 3, grants: 1 });
    expect(repo.deleteExpiredAuthCodes).toHaveBeenCalledOnce();
    expect(repo.deleteExpiredGrants).toHaveBeenCalledOnce();
  });

  it('returns zero counts on error', async () => {
    const repo = {
      deleteExpiredAuthCodes: vi.fn().mockRejectedValue(new Error('boom')),
      deleteExpiredGrants: vi.fn(),
    };
    const svc = new OAuthCleanupService(repo as unknown as OAuthRepository);
    const result = await svc.runCleanup();
    expect(result).toEqual({ codes: 0, grants: 0 });
  });
});
