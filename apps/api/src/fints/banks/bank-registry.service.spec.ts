import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { BankRegistryService } from './bank-registry.service';
import type { BankRegistryRepository } from './bank-registry.repository';

function makeConfig(sources: string[] = []): ConfigService {
  return {
    get: (k: string) => (k === 'fints.blzSourceUrls' ? sources : undefined),
  } as unknown as ConfigService;
}

function makeRepo(): BankRegistryRepository {
  return {
    findLatest: vi.fn().mockResolvedValue(null),
    replace: vi.fn(),
    touch: vi.fn(),
  } as unknown as BankRegistryRepository;
}

describe('BankRegistryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lookup returns fallback record for known BLZ on cold start', async () => {
    const svc = new BankRegistryService(makeConfig(), makeRepo());
    await svc.onModuleInit();
    const result = svc.lookup('37050198');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.record.name).toContain('Sparkasse');
      expect(result.fintsCapable).toBe(true);
    }
  });

  it('lookup returns not-found with manual-override hint for unknown BLZ', () => {
    const svc = new BankRegistryService(makeConfig(), makeRepo());
    svc.onModuleInit();
    const result = svc.lookup('99999999');
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.allowManualOverride).toBe(true);
    }
  });

  it('status reports fallbackInUse=true when no DB snapshot exists', async () => {
    const svc = new BankRegistryService(makeConfig(), makeRepo());
    await svc.onModuleInit();
    expect(svc.status().fallbackInUse).toBe(true);
  });

  it('refresh skips when no sources are configured', async () => {
    const svc = new BankRegistryService(makeConfig([]), makeRepo());
    await svc.onModuleInit();
    const result = await svc.refresh();
    expect(result.updated).toBe(false);
  });

  it('refresh rejects sources whose payload is implausibly small', async () => {
    const repo = makeRepo();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('37050198=Tiny|Köln||00|||||', { status: 200 }),
    );
    const svc = new BankRegistryService(makeConfig(['https://example.test/blz']), repo);
    await svc.onModuleInit();
    const result = await svc.refresh();
    expect(result.updated).toBe(false);
    expect(repo.replace).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('refresh persists snapshot when payload meets minimum size', async () => {
    const repo = makeRepo();
    // Generate enough records (>=1000) to pass the min-size guard
    const lines: string[] = [];
    for (let i = 0; i < 1100; i++) {
      const blz = String(10000000 + i).padStart(8, '0');
      lines.push(`${blz}=Test Bank ${i}|City|BIC${i}|00|host|https://example.test/fints|300|300|`);
    }
    const body = lines.join('\n');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    vi.mocked(repo.replace).mockResolvedValue({
      id: 1,
      fetchedAt: new Date(),
      sourceCommit: null,
      sourceUrl: 'https://example.test/blz',
      recordCount: 1100,
      banks: [] as never,
      contentHash: 'abc',
    });

    const svc = new BankRegistryService(makeConfig(['https://example.test/blz']), repo);
    await svc.onModuleInit();
    // Wait for the boot-time background refresh to settle before the explicit one
    await new Promise(r => setImmediate(r));
    vi.mocked(repo.replace).mockClear();
    const result = await svc.refresh();
    expect(result.updated).toBe(true);
    expect(repo.replace).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });
});
