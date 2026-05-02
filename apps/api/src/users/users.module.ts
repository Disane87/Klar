import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HouseholdsModule } from '../households/households.module';
import { OidcRepository } from '../oidc/oidc.repository';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RefreshTokenRepository } from '../auth/repositories/refresh-token.repository';

@Module({
  imports: [PrismaModule, AuditModule, HouseholdsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RefreshTokenRepository, OidcRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
