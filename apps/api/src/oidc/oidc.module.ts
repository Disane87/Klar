import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { HouseholdsModule } from '../households/households.module';
import { AuditModule } from '../audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';
import { OidcRepository } from './oidc.repository';
import { OidcService } from './oidc.service';

@Module({
  imports: [PrismaModule, UsersModule, HouseholdsModule, AuditModule, CategoriesModule],
  providers: [OidcRepository, OidcService],
  exports: [OidcService],
})
export class OidcModule {}
