import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { FintsConnection, FintsSyncRun } from '@prisma/client';
import { FintsSyncScheduler } from './fints-sync.scheduler';
import type { FintsConnectionRepository } from '../connection/fints-connection.repository';
import type { FintsSyncRunRepository } from './fints-sync-run.repository';
import type { FintsSyncService } from './fints-sync.service';

const makeConn = (overrides: Partial<FintsConnection> = {}): FintsConnection => ({
  id: 'c1',
  ownerId: 'u1',
  householdId: 'hh1',
  bankName: 'Sparkasse Test',
  blz: '37050198',
  serverUrl: 'https://x',
  loginName: 'login',
  credentialsCipher: Buffer.from(''),
  credentialsIv: Buffer.from(''),
  credentialsTag: Buffer.from(''),
  status: 'ACTIVE',
  lastScaAt: new Date('2026-02-01'),
  scaExpiresAt: new Date('2026-08-01'),
  lastSyncAt: null,
  lastSyncStatus: null,
  capabilitiesJson: null,
  syncInterval: 'H24',
  syncEnabled: true,
  nextSyncAt: null,
  createdAt: new Date('2026-02-01'),
  updatedAt: new Date('2026-02-01'),
  ...overrides,
});

interface Deps {
  registry: SchedulerRegistry;
  config: ConfigService;
  connections: FintsConnectionRepository;
  syncRuns: FintsSyncRunRepository;
  sync: FintsSyncService;
}

function buildDeps(configValues: Record<string, unknown> = {}): Deps {
  const registry = {
    addInterval: vi.fn(),
    deleteInterval: vi.fn(),
  } as unknown as SchedulerRegistry;
  const config = {
    get: vi.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const connections = {
    findDueForCronSync: vi.fn().mockResolvedValue([]),
    stampSync: vi.fn().mockResolvedValue(undefined),
  } as unknown as FintsConnectionRepository;
  const syncRuns = {
    findRunning: vi.fn().mockResolvedValue(null),
  } as unknown as FintsSyncRunRepository;
  const sync = {
    start: vi.fn().mockResolvedValue({}),
  } as unknown as FintsSyncService;
  return { registry, config, connections, syncRuns, sync };
}

function buildScheduler(deps: Deps): FintsSyncScheduler {
  return new FintsSyncScheduler(
    deps.registry,
    deps.config,
    deps.connections,
    deps.syncRuns,
    deps.sync,
  );
}

describe('FintsSyncScheduler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to 60-minute default when config is missing', () => {
    const deps = buildDeps();
    const scheduler = buildScheduler(deps);
    expect(scheduler.getIntervalMinutes()).toBe(60);
  });

  it('honours configured interval', () => {
    const deps = buildDeps({ 'fints.syncIntervalMinutes': 15 });
    const scheduler = buildScheduler(deps);
    expect(scheduler.getIntervalMinutes()).toBe(15);
  });

  it('clamps interval to a 5-minute minimum', () => {
    const deps = buildDeps({ 'fints.syncIntervalMinutes': 1 });
    const scheduler = buildScheduler(deps);
    expect(scheduler.getIntervalMinutes()).toBe(5);
  });

  it('floors fractional minutes', () => {
    const deps = buildDeps({ 'fints.syncIntervalMinutes': 17.8 });
    const scheduler = buildScheduler(deps);
    expect(scheduler.getIntervalMinutes()).toBe(17);
  });

  it('triggers CRON sync for every ACTIVE connection without a blocking run', async () => {
    const deps = buildDeps();
    vi.mocked(deps.connections.findDueForCronSync).mockResolvedValue([
      makeConn({ id: 'c1' }),
      makeConn({ id: 'c2' }),
    ]);
    const scheduler = buildScheduler(deps);

    const summary = await scheduler.tick();

    expect(deps.sync.start).toHaveBeenCalledTimes(2);
    expect(deps.sync.start).toHaveBeenCalledWith('c1', {
      triggeredBy: 'CRON',
      triggeredById: null,
    });
    expect(deps.sync.start).toHaveBeenCalledWith('c2', {
      triggeredBy: 'CRON',
      triggeredById: null,
    });
    expect(summary).toEqual({ started: 2, skipped: 0, failed: 0, total: 2 });
  });

  it('skips connections that still have a RUNNING or TAN_REQUIRED run', async () => {
    const deps = buildDeps();
    vi.mocked(deps.connections.findDueForCronSync).mockResolvedValue([
      makeConn({ id: 'c1' }),
      makeConn({ id: 'c2' }),
    ]);
    vi.mocked(deps.syncRuns.findRunning).mockImplementation(async (id: string) =>
      id === 'c1' ? ({ id: 'run1' } as FintsSyncRun) : null,
    );
    const scheduler = buildScheduler(deps);

    const summary = await scheduler.tick();

    expect(deps.sync.start).toHaveBeenCalledTimes(1);
    expect(deps.sync.start).toHaveBeenCalledWith('c2', expect.any(Object));
    expect(summary).toEqual({ started: 1, skipped: 1, failed: 0, total: 2 });
  });

  it('records a per-connection failure but continues with the remaining connections', async () => {
    const deps = buildDeps();
    vi.mocked(deps.connections.findDueForCronSync).mockResolvedValue([
      makeConn({ id: 'c1' }),
      makeConn({ id: 'c2' }),
    ]);
    vi.mocked(deps.sync.start).mockImplementation(async (id: string) => {
      if (id === 'c1') throw new Error('bank says nope');
      return { syncRun: {} as FintsSyncRun };
    });
    const scheduler = buildScheduler(deps);

    const summary = await scheduler.tick();

    expect(deps.sync.start).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ started: 1, skipped: 0, failed: 1, total: 2 });
  });

  it('is re-entrant safe — a tick that fires while one is still running is a no-op', async () => {
    const deps = buildDeps();
    vi.mocked(deps.connections.findDueForCronSync).mockImplementation(
      () => new Promise<FintsConnection[]>(() => { /* never resolves */ }),
    );
    const scheduler = buildScheduler(deps);

    // Kick off the first tick — it suspends inside findDueForCronSync and
    // never returns, keeping inFlight=true for the rest of the test.
    void scheduler.tick();

    const second = await scheduler.tick();
    expect(second).toEqual({ started: 0, skipped: 0, failed: 0, total: 0 });
    expect(deps.sync.start).not.toHaveBeenCalled();
  });
});
