import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';
import type { AdminRepository, AuditLogWithRefs, EmailLogWithRefs } from './admin.repository';

const NOW = new Date('2026-01-15T10:00:00Z');

function buildAuditRow(overrides: Partial<AuditLogWithRefs> = {}): AuditLogWithRefs {
  return {
    id: 'a1',
    createdAt: NOW,
    userId: 'u1',
    householdId: 'h1',
    action: 'mcp.tool.transactions.list',
    metadata: {
      toolName: 'transactions.list',
      clientId: 'klar_mcp_x',
      durationMs: 12,
      ok: true,
      argsHash: 'a'.repeat(64),
    },
    ip: '127.0.0.1',
    userAgent: 'ua',
    user: { id: 'u1', displayName: 'Alice', email: 'a@b', avatarUrl: null },
    household: { id: 'h1', name: 'Home' },
    ...overrides,
  };
}

describe('AdminService.listAuditLogs', () => {
  it('delegates to repo and maps DTOs', async () => {
    const repo = {
      findAuditLogs: vi.fn().mockResolvedValue({
        data: [buildAuditRow()],
        nextCursor: null,
        total: 1,
      }),
    } as unknown as AdminRepository;
    const svc = new AdminService(repo);

    const result = await svc.listAuditLogs({ pageSize: 50 });
    expect(result.total).toBe(1);
    expect(result.data[0]!.user).toEqual({
      id: 'u1',
      displayName: 'Alice',
      email: 'a@b',
      avatarUrl: null,
    });
    expect(result.data[0]!.household).toEqual({ id: 'h1', name: 'Home' });
  });
});

describe('AdminService.listMcpAuditLogs', () => {
  it('forces actionPrefix mcp. and resolves client names', async () => {
    const findAuditLogs = vi.fn().mockResolvedValue({
      data: [buildAuditRow()],
      nextCursor: null,
      total: 1,
    });
    const resolveOAuthClientNames = vi
      .fn()
      .mockResolvedValue(new Map([['klar_mcp_x', 'Claude Desktop']]));
    const repo = { findAuditLogs, resolveOAuthClientNames } as unknown as AdminRepository;
    const svc = new AdminService(repo);

    const result = await svc.listMcpAuditLogs({ pageSize: 50 });
    expect(findAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ actionPrefix: 'mcp.' }),
    );
    expect(resolveOAuthClientNames).toHaveBeenCalledWith(['klar_mcp_x']);
    expect(result.data[0]).toMatchObject({
      toolName: 'transactions.list',
      clientId: 'klar_mcp_x',
      clientName: 'Claude Desktop',
      durationMs: 12,
      ok: true,
      errorCode: null,
    });
  });

  it('lifts errorCode when present and ok=false', async () => {
    const repo = {
      findAuditLogs: vi.fn().mockResolvedValue({
        data: [
          buildAuditRow({
            metadata: {
              toolName: 'transactions.create',
              clientId: 'klar_mcp_x',
              durationMs: 5,
              ok: false,
              errorCode: 'TypeError',
            },
          }),
        ],
        nextCursor: null,
        total: 1,
      }),
      resolveOAuthClientNames: vi.fn().mockResolvedValue(new Map()),
    } as unknown as AdminRepository;
    const svc = new AdminService(repo);

    const result = await svc.listMcpAuditLogs({ pageSize: 50 });
    expect(result.data[0]!.ok).toBe(false);
    expect(result.data[0]!.errorCode).toBe('TypeError');
    expect(result.data[0]!.clientName).toBeNull();
  });
});

describe('AdminService.listHouseholds', () => {
  it('maps members to summary', async () => {
    const repo = {
      listHouseholdsWithMembers: vi.fn().mockResolvedValue([
        {
          id: 'h1',
          name: 'Test',
          createdAt: NOW,
          memberships: [
            {
              role: 'OWNER',
              joinedAt: NOW,
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
});

describe('AdminService.toEmailDto', () => {
  it('stringifies sentAt and exposes resolved refs', () => {
    const svc = new AdminService({} as AdminRepository);
    const row: EmailLogWithRefs = {
      id: 'e1',
      to: 'a@b',
      subject: 'sub',
      template: 'invite',
      status: 'SENT',
      error: null,
      userId: null,
      householdId: 'h1',
      sentAt: NOW,
      user: null,
      household: { id: 'h1', name: 'Home' },
    };
    const out = svc.toEmailDto(row);
    expect(out.sentAt).toBe(NOW.toISOString());
    expect(out.household?.name).toBe('Home');
  });
});
