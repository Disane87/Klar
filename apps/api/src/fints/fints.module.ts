import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FintsCryptoService } from './crypto/fints-crypto.service';
import { BankRegistryRepository } from './banks/bank-registry.repository';
import { BankRegistryService } from './banks/bank-registry.service';
import { BlzRefreshScheduler } from './banks/blz-refresh.scheduler';
import { FintsConnectionRepository } from './connection/fints-connection.repository';
import { ReauthWatcherScheduler } from './reauth/reauth-watcher.scheduler';
import { FintsClientService } from './client/fints-client.service';

/**
 * FinTS module (Phases 14a.3 + 14a.4 + 14a.7-partial).
 *
 * Provides:
 *   - FintsCryptoService — AES-256-GCM for connection credentials
 *   - BankRegistryService — BLZ → bank-record lookup, refreshable
 *   - FintsConnectionRepository — DB access for the connection model
 *   - BlzRefreshScheduler — daily 03:30 cron, refreshes BLZ registry
 *   - ReauthWatcherScheduler — daily 08:00 cron, 7-day SCA pre-warning
 *     plus REAUTH_REQUIRED state transition for expired connections
 *
 * Subsequent phases add (in order):
 *   14a.5 — client/* (lib-fints wrapper) and mapper/* (FinTS booking → RawBooking)
 *   14a.6 — fints.controller, setup wizard endpoints
 *   14a.7 — sync/* (runner + scheduler) — final sync cron piece
 *   14a.8 — lockout UI integration (frontend-side)
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [
    FintsCryptoService,
    BankRegistryRepository,
    BankRegistryService,
    BlzRefreshScheduler,
    FintsConnectionRepository,
    ReauthWatcherScheduler,
    FintsClientService,
  ],
  exports: [
    FintsCryptoService,
    BankRegistryService,
    FintsConnectionRepository,
    FintsClientService,
  ],
})
export class FintsModule {}
