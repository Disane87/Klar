import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { OverviewModule } from '../overview/overview.module';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeyScopeGuard } from './api-key-scope.guard';
import { ApiKeysController } from './api-keys.controller';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [
    PrismaModule,
    HouseholdsModule,
    CategoriesModule,
    TransactionsModule,
    OverviewModule,
  ],
  providers: [
    ApiKeysRepository,
    ApiKeysService,
    ApiKeyAuthGuard,
    ApiKeyScopeGuard,
  ],
  controllers: [ApiKeysController, PublicApiController],
  exports: [ApiKeysService, ApiKeyAuthGuard, ApiKeyScopeGuard],
})
export class ApiKeysModule {}
