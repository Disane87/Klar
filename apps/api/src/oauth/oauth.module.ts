import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OAuthController } from './oauth.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OAuthController],
  providers: [],
  exports: [],
})
export class OAuthModule {}
