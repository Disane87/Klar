import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { BankRegistryRepository } from './bank-registry.repository';
import { parseBlzProperties } from './blz-parser';
import type { BankLookupResult, BankRecord } from './bank-record';
import { BANKS_FALLBACK } from './banks.fallback';

interface FetchResult {
  ok: boolean;
  url: string;
  status?: number;
  body?: string;
  contentHash?: string;
  notModified?: boolean;
  error?: string;
}

/**
 * BLZ registry (Phase 14a.4).
 *
 * Boot sequence:
 *   1. Load bundled fallback into in-memory cache so cold start always
 *      works, even offline.
 *   2. Replace cache with the latest persisted snapshot if newer.
 *   3. Trigger a non-blocking refresh when the persisted snapshot is
 *      older than 7 days or absent entirely.
 *
 * The scheduled daily refresh lands in 14a.7 (cron phase). For now the
 * service exposes refresh() as an explicit trigger (admin route in 14a.6
 * and the boot-time check below).
 */
@Injectable()
export class BankRegistryService implements OnModuleInit {
  private static readonly STALE_AFTER_DAYS = 7;
  private static readonly MIN_RECORDS = 1000; // upstream typically ships ~3500
  private readonly logger = new Logger(BankRegistryService.name);

  private cache = new Map<string, BankRecord>();

  constructor(
    private readonly config: ConfigService,
    private readonly repo: BankRegistryRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    this.loadFallbackIntoCache();

    try {
      const latest = await this.repo.findLatest();
      if (latest && Array.isArray(latest.banks)) {
        this.cache = this.indexById(latest.banks as unknown as BankRecord[]);
        this.logger.log(
          `Loaded ${latest.recordCount} BLZ records from snapshot (${latest.fetchedAt.toISOString()})`,
        );

        const ageMs = Date.now() - latest.fetchedAt.getTime();
        const stale = ageMs > BankRegistryService.STALE_AFTER_DAYS * 86_400_000;
        if (stale) {
          // Fire-and-forget — boot must not block on network
          this.refresh().catch(err =>
            this.logger.warn(`Background refresh failed: ${err}`),
          );
        }
      } else {
        this.logger.warn('No BLZ snapshot in DB — using fallback bundle');
        this.refresh().catch(err =>
          this.logger.warn(`Initial refresh failed: ${err}`),
        );
      }
    } catch (err) {
      this.logger.warn(
        `BLZ registry init: DB read failed, staying on fallback: ${err}`,
      );
    }
  }

  /**
   * Returns the resolution result for a BLZ. Three cases:
   *   - found + fintsCapable: ready to plug into the FinTS setup wizard
   *   - found + !fintsCapable: bank is known but doesn't ship a PIN/TAN URL;
   *     UI surfaces the message and falls back to manual entry
   *   - not found: BLZ unknown to us — UI offers manual entry
   */
  lookup(blz: string): BankLookupResult {
    const record = this.cache.get(blz.trim());
    if (!record) return { found: false, allowManualOverride: true };
    const fintsCapable = !!record.pinTanUrl;
    return {
      found: true,
      record,
      fintsCapable,
      message: fintsCapable
        ? undefined
        : 'Bank in Liste, aber kein FinTS-PIN/TAN-Zugang gemeldet',
    };
  }

  /** Returns a status snapshot for diagnostics / admin endpoints. */
  status(): {
    cachedRecords: number;
    fallbackInUse: boolean;
  } {
    return {
      cachedRecords: this.cache.size,
      fallbackInUse: this.cache.size === BANKS_FALLBACK.records.length,
    };
  }

  /**
   * Refreshes the registry from the configured upstream URLs. Tries each
   * source in order; first one that returns a parseable, plausibly-sized
   * payload wins. On total failure the cache stays as-is — registry must
   * never go silently empty.
   */
  async refresh(): Promise<{ updated: boolean; recordCount: number }> {
    const sources = this.config.get<string[]>('fints.blzSourceUrls') ?? [];
    if (sources.length === 0) {
      this.logger.warn('No FINTS_BLZ_SOURCES configured — skipping refresh');
      return { updated: false, recordCount: this.cache.size };
    }

    const latest = await this.repo.findLatest();

    for (const url of sources) {
      const fetched = await this.fetchOnce(url, latest?.contentHash ?? null);
      if (!fetched.ok) {
        this.logger.warn(`Source ${url} failed: ${fetched.error}`);
        continue;
      }

      if (fetched.notModified && latest) {
        await this.repo.touch(latest.id);
        this.logger.debug(`BLZ source unchanged (${url})`);
        return { updated: false, recordCount: this.cache.size };
      }

      const parsed = parseBlzProperties(fetched.body!);
      if (parsed.records.length < BankRegistryService.MIN_RECORDS) {
        this.logger.warn(
          `Refusing snapshot from ${url}: only ${parsed.records.length} records (minimum ${BankRegistryService.MIN_RECORDS})`,
        );
        continue;
      }

      const persisted = await this.repo.replace({
        sourceUrl: url,
        contentHash: fetched.contentHash!,
        records: parsed.records,
      });
      this.cache = this.indexById(parsed.records);
      this.logger.log(
        `BLZ registry updated from ${url}: ${parsed.records.length} records, ${parsed.skipped.length} skipped`,
      );
      return { updated: true, recordCount: persisted.recordCount };
    }

    this.logger.warn('All BLZ refresh sources failed — keeping current cache');
    return { updated: false, recordCount: this.cache.size };
  }

  private async fetchOnce(url: string, knownHash: string | null): Promise<FetchResult> {
    try {
      const res = await fetch(url, {
        // Conditional fetch via ETag if we ever store one. hbci4j's raw
        // GitHub URL doesn't return useful ETags, so we rely on
        // contentHash post-fetch instead.
        headers: { 'User-Agent': 'klar/fints-registry' },
      });
      if (!res.ok) {
        return { ok: false, url, status: res.status, error: `HTTP ${res.status}` };
      }
      const body = await res.text();
      const contentHash = createHash('sha256').update(body).digest('hex');
      const notModified = knownHash !== null && knownHash === contentHash;
      return { ok: true, url, status: res.status, body, contentHash, notModified };
    } catch (err) {
      return { ok: false, url, error: (err as Error).message };
    }
  }

  private loadFallbackIntoCache(): void {
    this.cache = this.indexById(BANKS_FALLBACK.records as BankRecord[]);
  }

  private indexById(records: BankRecord[]): Map<string, BankRecord> {
    const map = new Map<string, BankRecord>();
    for (const r of records) map.set(r.blz, r);
    return map;
  }
}
