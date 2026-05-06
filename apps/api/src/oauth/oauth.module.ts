import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { OAuthRepository } from './oauth.repository';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OAuthController],
  providers: [OAuthService, OAuthRepository],
  exports: [OAuthService, OAuthRepository],
})
export class OAuthModule {}
