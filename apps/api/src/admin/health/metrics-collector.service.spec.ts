import { describe, expect, it, vi } from 'vitest';
import {
  MetricsCollectorService,
  type ServiceProbe,
  type ServiceProbeState,
} from './metrics-collector.service';
import type { PrismaService } from '../../prisma/prisma.service';

function buildPrisma(totals: number[]): PrismaService {
  let i = 0;
  return {
    $queryRaw: vi.fn().mockImplementation(() => {
      const total = totals[Math.min(i, totals.length - 1)];
      i++;
      return Promise.resolve([{ total: BigInt(total) }]);
    }),
  } as unknown as PrismaService;
}

function makeProbe(name: string, states: ServiceProbeState[]): ServiceProbe {
  let i = 0;
  return {
    name: () => name,
    meta: () => `${name}-meta`,
    probe: vi.fn().mockImplementation(() => {
      const s = states[Math.min(i, states.length - 1)];
      i++;
      return Promise.resolve(s);
    }),
  };
}

describe('MetricsCollectorService.sampleDbQueries', () => {
  it('does not record a point on the very first sample (no baseline yet)', async () => {
    const collector = new MetricsCollectorService(buildPrisma([100]));

    await collector.sample();

    expect(collector.getDbQueryHistory().points).toEqual([]);
  });

  it('records the delta between successive samples', async () => {
    const collector = new MetricsCollectorService(buildPrisma([100, 142, 200]));

    await collector.sample(); // baseline
    await collector.sample(); // delta = 42
    await collector.sample(); // delta = 58

    expect(collector.getDbQueryHistory().points).toEqual([42, 58]);
  });

  it('clamps negative deltas (counter wrap / db restart) to 0', async () => {
    const collector = new MetricsCollectorService(buildPrisma([500, 10]));

    await collector.sample();
    await collector.sample();

    expect(collector.getDbQueryHistory().points).toEqual([0]);
  });

  it('caps history at 30 points and exposes peak + avg', async () => {
    const totals: number[] = [];
    let acc = 0;
    for (let i = 0; i <= 35; i++) {
      acc += i;
      totals.push(acc);
    }
    const collector = new MetricsCollectorService(buildPrisma(totals));

    for (let i = 0; i < totals.length; i++) await collector.sample();

    const history = collector.getDbQueryHistory();
    expect(history.points).toHaveLength(30);
    expect(history.peak).toBe(35);
    expect(history.avg).toBeGreaterThan(0);
  });

  it('skips the sample on query errors without losing the previous baseline', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ total: 100n }])
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce([{ total: 150n }]),
    } as unknown as PrismaService;
    const collector = new MetricsCollectorService(prisma);

    await collector.sample(); // baseline = 100
    await collector.sample(); // errored
    await collector.sample(); // delta from baseline 100 → 150 = 50

    expect(collector.getDbQueryHistory().points).toEqual([50]);
  });
});

describe('MetricsCollectorService.sampleServices', () => {
  it('records the latest state per probe and keeps a rolling bucket history', async () => {
    const collector = new MetricsCollectorService(buildPrisma([0]));
    const probe = makeProbe('Postgres', ['ok', 'ok', 'warn']);
    collector.registerProbes([probe]);

    await collector.sample();
    await collector.sample();
    await collector.sample();

    const buckets = collector.getServiceBuckets();
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.name).toBe('Postgres');
    expect(buckets[0]!.state).toBe('warn');
    expect(buckets[0]!.buckets).toEqual(['ok', 'ok', 'warn']);
  });

  it('caps each service bucket at 30 entries', async () => {
    const collector = new MetricsCollectorService(buildPrisma([0]));
    // Warn lands in the first bucket — dropped once 5 newer 'ok' samples push
    // it out of the 30-slot window.
    const states: ServiceProbeState[] = Array.from({ length: 35 }, (_, i) => (i === 2 ? 'warn' : 'ok'));
    collector.registerProbes([makeProbe('API', states)]);

    for (let i = 0; i < 35; i++) await collector.sample();

    const buckets = collector.getServiceBuckets();
    expect(buckets[0]!.buckets).toHaveLength(30);
    expect(buckets[0]!.buckets.includes('warn')).toBe(false);
  });

  it('marks a probe as error when probe() throws', async () => {
    const collector = new MetricsCollectorService(buildPrisma([0]));
    const throwingProbe: ServiceProbe = {
      name: () => 'MCP',
      meta: () => 'meta',
      probe: vi.fn().mockRejectedValue(new Error('unreachable')),
    };
    collector.registerProbes([throwingProbe]);

    await collector.sample();

    expect(collector.getServiceBuckets()[0]!.buckets).toEqual(['error']);
  });
});
