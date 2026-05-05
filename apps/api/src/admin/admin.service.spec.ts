import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';
import type { AdminRepository } from './admin.repository';

describe('AdminService', () => {
  it('listAuditLogs delegates to repo', async () => {
    const repo = {
      findAuditLogs: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 }),
    } as unknown as AdminRepository;
    const svc = new AdminService(repo);

    const result = await svc.listAuditLogs({ page: 1, pageSize: 50 });
    expect(result.total).toBe(0);
    expect(repo.findAuditLogs).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
  });

  it('listHouseholds maps members to summary', async () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const repo = {
      listHouseholdsWithMembers: vi.fn().mockResolvedValue([
        {
          id: 'h1',
          name: 'Test',
          createdAt: now,
          memberships: [
            {
              role: 'OWNER',
              joinedAt: now,
              user: { id: 'u1', displayName: 'Alice', email: 'a@b', avatarUrl: null },
            },
          ],
        },
      ]),
    } as unknown as AdminRepository;
    const svc = new AdminService(repo);

    const result = await svc.listHouseholds();
    expect(result).toHaveLength(1);
    expect(result[0]!.members[0]).toMatchObject({
      userId: 'u1',
      displayName: 'Alice',
      role: 'OWNER',
    });
  });

  it('toEmailResponse hides nothing relevant and stringifies sentAt', () => {
    const svc = new AdminService({} as AdminRepository);
    const out = svc.toEmailResponse({
      id: 'e1',
      to: 'a@b',
      subject: 'sub',
      template: 'invite',
      status: 'SENT',
      error: null,
      userId: null,
      householdId: 'h1',
      sentAt: new Date('2026-01-15T10:00:00Z'),
    });
    expect(out.sentAt).toBe('2026-01-15T10:00:00.000Z');
    expect(out.status).toBe('SENT');
  });
});
