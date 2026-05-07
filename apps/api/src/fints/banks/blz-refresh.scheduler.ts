import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BankRegistryService } from './bank-registry.service';

/**
 * Daily BLZ-registry refresh (Phase 14a.7 — follow-up to 14a.4).
 *
 * Runs at 03:30 local time, 30 minutes after the FinTS sync cron will
 * land in 14a.7+. The actual refresh logic (fetch, parse, validate,
 * persist) lives in BankRegistryService.refresh(); the scheduler only
 * triggers it and logs the outcome. Errors are swallowed by the service
 * so a single source-side outage cannot crash the cron.
 */
@Injectable()
export class BlzRefreshScheduler {
  private readonly logger = new Logger(BlzRefreshScheduler.name);

  constructor(private readonly registry: BankRegistryService) {}

  @Cron('30 3 * * *')
  async runDaily(): Promise<void> {
    try {
      const result = await this.registry.refresh();
      this.logger.log(
        `Daily BLZ refresh: updated=${result.updated}, records=${result.recordCount}`,
      );
    } catch (err) {
      // refresh() already logs source-level errors; this catches truly
      // unexpected exceptions (DB outage, fatal parser bug).
      this.logger.error(`Daily BLZ refresh threw: ${err}`);
    }
  }
}
