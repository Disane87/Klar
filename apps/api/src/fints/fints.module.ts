import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ImportPipelineModule } from '../import-pipeline/import-pipeline.module';
import { StandingOrdersModule } from '../standing-orders/standing-orders.module';
import { FixedCostsModule } from '../fixed-costs/fixed-costs.module';
import { FintsCryptoService } from './crypto/fints-crypto.service';
import { BankRegistryRepository } from './banks/bank-registry.repository';
import { BankRegistryService } from './banks/bank-registry.service';
import { BlzRefreshScheduler } from './banks/blz-refresh.scheduler';
import { FintsConnectionRepository } from './connection/fints-connection.repository';
import { ReauthWatcherScheduler } from './reauth/reauth-watcher.scheduler';
import { FintsClientService } from './client/fints-client.service';
import { FintsRealtimeService } from './realtime/fints-realtime.service';
import { FintsSyncRunRepository } from './sync/fints-sync-run.repository';
import { FintsSyncScheduler } from './sync/fints-sync.scheduler';
import { FintsSyncService } from './sync/fints-sync.service';
import { FintsService } from './fints.service';
import { FintsController } from './fints.controller';

/**
 * FinTS module (Phases 14a.3 + 14a.4 + 14a.5 + 14a.6 + 14a.7).
 *
 * Provides:
 *   - FintsCryptoService — AES-256-GCM for connection credentials
 *   - BankRegistryService — BLZ → bank-record lookup, refreshable
 *   - FintsConnectionRepository — DB access for the connection model
 *   - BlzRefreshScheduler — daily 03:30 cron, refreshes BLZ registry
 *   - ReauthWatcherScheduler — daily 08:00 cron, 7-day SCA pre-warning
 *     plus REAUTH_REQUIRED state transition for expired connections
 *   - FintsClientService — lib-fints wrapper
 *   - FintsSyncService — sync runner (manual + cron + setup)
 *   - FintsSyncScheduler — automatic sync cron, interval configurable
 *     via FINTS_SYNC_INTERVAL_MINUTES (default 60, min 5);
 *     disable via FINTS_SYNC_DISABLED=true
 *
 * Subsequent phases:
 *   14a.8 — lockout UI integration (frontend-side)
 */
@Module({
  imports: [
    PrismaModule,
    HouseholdsModule,
    NotificationsModule,
    ImportPipelineModule,
    StandingOrdersModule,
    FixedCostsModule,
  ],
  providers: [
    FintsCryptoService,
    BankRegistryRepository,
    BankRegistryService,
    BlzRefreshScheduler,
    FintsConnectionRepository,
    ReauthWatcherScheduler,
    FintsClientService,
    FintsRealtimeService,
    FintsSyncRunRepository,
    FintsSyncService,
    FintsSyncScheduler,
    FintsService,
  ],
  controllers: [FintsController],
  exports: [
    FintsCryptoService,
    BankRegistryService,
    FintsConnectionRepository,
    FintsClientService,
    FintsSyncService,
    FintsSyncRunRepository,
    FintsSyncScheduler,
  ],
})
export class FintsModule {}
