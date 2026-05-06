import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HouseholdsModule } from '../households/households.module';
import { OAuthController } from './oauth.controller';
import { OAuthConsentController } from './oauth-consent.controller';
import { OAuthService } from './oauth.service';
import { OAuthRepository } from './oauth.repository';

@Module({
  imports: [PrismaModule, AuditModule, HouseholdsModule],
  controllers: [OAuthController, OAuthConsentController],
  providers: [OAuthService, OAuthRepository],
  exports: [OAuthService, OAuthRepository],
})
export class OAuthModule {}
