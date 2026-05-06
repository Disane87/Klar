import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OAuthRepository } from './oauth.repository';

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // alle 15 Minuten
const REVOKED_GRANT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 Tage

/**
 * Hintergrund-Cleanup für OAuth-Tabellen:
 * - abgelaufene `OAuthAuthCode`-Einträge (TTL 60s, sofort sinnvoll zu löschen)
 * - revoked `OAuthGrant`-Einträge älter als 90 Tage
 *
 * Wir nutzen `setInterval` (kein @nestjs/schedule), weil das die einzige
 * Background-Aufgabe in Klar ist und die zusätzliche Dependency vermeidet.
 *
 * Single-instance-safe: bei mehreren API-Instanzen läuft das Cleanup
 * mehrfach idempotent — DELETE-Statements interferieren nicht.
 */
@Injectable()
export class OAuthCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OAuthCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly repo: OAuthRepository) {}

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    this.timer = setInterval(() => {
      void this.runCleanup();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runCleanup(): Promise<{ codes: number; grants: number }> {
    try {
      const codes = await this.repo.deleteExpiredAuthCodes(new Date());
      const grants = await this.repo.deleteExpiredGrants(
        new Date(Date.now() - REVOKED_GRANT_TTL_MS),
      );
      if (codes.count > 0 || grants.count > 0) {
        this.logger.log(`OAuth cleanup: removed ${codes.count} codes, ${grants.count} grants`);
      }
      return { codes: codes.count, grants: grants.count };
    } catch (err) {
      this.logger.error('OAuth cleanup failed', err);
      return { codes: 0, grants: 0 };
    }
  }
}
