import { describe, expect, it, vi } from 'vitest';
import { AdminHealthServiceImpl } from './admin-health.service';
import type { PrismaService } from '../../prisma/prisma.service';

function buildPrisma(overrides: Partial<Record<keyof PrismaService | '$queryRaw', unknown>> = {}): PrismaService {
  const base = {
    $queryRaw: vi.fn().mockResolvedValue([{ size: 412n * 1024n * 1024n }]),
    auditLog: {
      count: vi.fn().mockResolvedValue(3),
      findFirst: vi.fn().mockResolvedValue({ id: 'a1' }),
      findMany: vi.fn().mockResolvedValue([
        { metadata: { durationMs: 10 } },
        { metadata: { durationMs: 20 } },
        { metadata: { durationMs: 30 } },
      ]),
    },
    refreshToken: {
      count: vi.fn().mockResolvedValue(7),
    },
    emailLog: {
      findMany: vi.fn().mockResolvedValue([
        { status: 'SENT' },
        { status: 'SENT' },
      ]),
    },
  };
  return { ...base, ...overrides } as unknown as PrismaService;
}

describe('AdminHealthServiceImpl.getStatus', () => {
  it('returns dbSize, warningCount, activeSessions and uptime', async () => {
    const prisma = buildPrisma();
    const svc = new AdminHealthServiceImpl(prisma);

    const result = await svc.getStatus();

    expect(result.dbSizeBytes).toBe(412 * 1024 * 1024);
    expect(result.warningCount).toBe(3);
    expect(result.activeSessions).toBe(7);
    expect(result.uptimeWindow).toBe('30d');
    expect(result.uptimePct).toBeGreaterThanOrEqual(0);
    expect(result.uptimePct).toBeLessThanOrEqual(99.99);
    expect(result.dbSizeDeltaBytes7d).toBe(0);
  });

  it('falls back to 0 on dbSize query errors', async () => {
    const prisma = buildPrisma({
      $queryRaw: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const svc = new AdminHealthServiceImpl(prisma);

    const result = await svc.getStatus();
    expect(result.dbSizeBytes).toBe(0);
  });
});

describe('AdminHealthServiceImpl.getServices', () => {
  it('marks postgres ok when SELECT 1 succeeds and mcp ok when recent activity exists', async () => {
    const prisma = buildPrisma();
    const svc = new AdminHealthServiceImpl(prisma);

    const { services } = await svc.getServices();

    expect(services.map((s) => s.name)).toEqual([
      'Web-App',
      'API',
      'Postgres 16',
      'MCP Bridge',
      'Mail-Queue',
    ]);
    expect(services.find((s) => s.name === 'Postgres 16')?.state).toBe('ok');
    expect(services.find((s) => s.name === 'MCP Bridge')?.state).toBe('ok');
    expect(services.find((s) => s.name === 'Mail-Queue')?.state).toBe('ok');
    expect(services[0]!.uptimeBars).toHaveLength(30);
  });

  it('marks postgres error and mcp warn when probes fail / empty', async () => {
    const prisma = buildPrisma({
      $queryRaw: vi.fn().mockRejectedValue(new Error('down')),
      auditLog: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      emailLog: {
        findMany: vi.fn().mockResolvedValue([{ status: 'FAILED' }]),
      },
    });
    const svc = new AdminHealthServiceImpl(prisma);

    const { services } = await svc.getServices();
    expect(services.find((s) => s.name === 'Postgres 16')?.state).toBe('error');
    expect(services.find((s) => s.name === 'MCP Bridge')?.state).toBe('warn');
    expect(services.find((s) => s.name === 'Mail-Queue')?.state).toBe('warn');
  });
});

describe('AdminHealthServiceImpl.getPerformance', () => {
  it('returns 6 keyed rows in fixed order', async () => {
    const prisma = buildPrisma();
    const svc = new AdminHealthServiceImpl(prisma);

    const { rows } = await svc.getPerformance();
    expect(rows.map((r) => r.key)).toEqual([
      'cpu',
      'ram',
      'disk',
      'dbQueryAvg',
      'mailQueue',
      'mcpLatency',
    ]);
    expect(rows.find((r) => r.key === 'mcpLatency')?.valueText).toBe('20 ms');
  });

  it('renders mcpLatency as em-dash when no MCP audit data exists', async () => {
    const prisma = buildPrisma({
      auditLog: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const svc = new AdminHealthServiceImpl(prisma);

    const { rows } = await svc.getPerformance();
    expect(rows.find((r) => r.key === 'mcpLatency')?.valueText).toBe('—');
  });
});

describe('AdminHealthServiceImpl.getJobs', () => {
  it('lists known scheduled jobs', async () => {
    const prisma = buildPrisma();
    const svc = new AdminHealthServiceImpl(prisma);

    const { jobs } = await svc.getJobs();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.find((j) => j.name === 'OAuth-Cleanup')).toBeDefined();
  });
});
