import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FintsCryptoService } from './crypto/fints-crypto.service';

/**
 * FinTS module skeleton (Phase 14a.3).
 *
 * Currently exposes the FintsCryptoService so future sub-modules
 * (sync runner, controller, BLZ registry) can depend on it. The module
 * is wired into AppModule so the master-key validation runs at boot.
 *
 * Subsequent phases add (in order):
 *   14a.4 — bank-registry/* (BLZ → server-URL lookup)
 *   14a.5 — client/* (lib-fints wrapper)
 *   14a.5 — mapper/* (lib-fints booking → RawBooking)
 *   14a.6 — fints.controller, setup wizard endpoints
 *   14a.7 — sync/* (runner + scheduler) and reauth/* (watcher)
 *   14a.8 — lockout UI integration (frontend-side)
 */
@Module({
  imports: [PrismaModule],
  providers: [FintsCryptoService],
  exports: [FintsCryptoService],
})
export class FintsModule {}
