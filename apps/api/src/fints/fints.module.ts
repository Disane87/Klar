import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FintsCryptoService } from './crypto/fints-crypto.service';
import { BankRegistryRepository } from './banks/bank-registry.repository';
import { BankRegistryService } from './banks/bank-registry.service';

/**
 * FinTS module (Phases 14a.3 + 14a.4).
 *
 * Provides:
 *   - FintsCryptoService — AES-256-GCM for connection credentials
 *   - BankRegistryService — BLZ → bank-record lookup, refreshable
 *
 * Subsequent phases add (in order):
 *   14a.5 — client/* (lib-fints wrapper) and mapper/* (FinTS booking → RawBooking)
 *   14a.6 — fints.controller, setup wizard endpoints
 *   14a.7 — sync/* (runner + scheduler) and reauth/* (watcher)
 *   14a.8 — lockout UI integration (frontend-side)
 */
@Module({
  imports: [PrismaModule],
  providers: [
    FintsCryptoService,
    BankRegistryRepository,
    BankRegistryService,
  ],
  exports: [FintsCryptoService, BankRegistryService],
})
export class FintsModule {}
