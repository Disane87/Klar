import { describe, it, expect, vi } from 'vitest';
import { AuditService } from './audit.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma(): PrismaService {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
}

describe('AuditService', () => {
  describe('log', () => {
    it('writes an audit log entry via prisma', () => {
      const prisma = makePrisma();
      const service = new AuditService(prisma);

      service.log({ action: 'user.login', userId: 'user-1', ip: '127.0.0.1' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'user.login', userId: 'user-1' }),
      });
    });

    it('includes metadata in the log entry when provided', () => {
      const prisma = makePrisma();
      const service = new AuditService(prisma);

      service.log({ action: 'admin.role_changed', metadata: { oldRole: 'USER', newRole: 'ADMIN' } });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { oldRole: 'USER', newRole: 'ADMIN' },
        }),
      });
    });

    it('does not propagate prisma errors to the caller', async () => {
      const prisma = makePrisma();
      vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('DB unavailable'));
      const service = new AuditService(prisma);

      expect(() => service.log({ action: 'user.login' })).not.toThrow();

      // Allow the rejected promise to settle without crashing
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });
});
