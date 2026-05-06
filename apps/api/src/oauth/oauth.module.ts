import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HouseholdsModule } from '../households/households.module';
import { OAuthController } from './oauth.controller';
import { OAuthConsentController } from './oauth-consent.controller';
import { OAuthGrantsController } from './oauth-grants.controller';
import { OAuthService } from './oauth.service';
import { OAuthRepository } from './oauth.repository';
import { OAuthCleanupService } from './oauth-cleanup.service';

@Module({
  imports: [PrismaModule, AuditModule, HouseholdsModule],
  controllers: [OAuthController, OAuthConsentController, OAuthGrantsController],
  providers: [OAuthService, OAuthRepository, OAuthCleanupService],
  exports: [OAuthService, OAuthRepository, OAuthCleanupService],
})
export class OAuthModule {}
