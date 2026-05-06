import { Module } from '@nestjs/common';
import { OAuthModule } from '../oauth/oauth.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProjectsModule } from '../projects/projects.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { OverviewModule } from '../overview/overview.module';
import { HouseholdsModule } from '../households/households.module';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { OAuthBearerGuard } from './guards/oauth-bearer.guard';

/**
 * MCP Resource Server.
 * Importiert alle Domain-Module, deren Services Tools aufrufen.
 */
@Module({
  imports: [
    OAuthModule,
    TransactionsModule,
    RecurringTransactionsModule,
    CategoriesModule,
    ProjectsModule,
    BudgetsModule,
    OverviewModule,
    HouseholdsModule,
  ],
  controllers: [McpController],
  providers: [McpServerFactory, OAuthBearerGuard],
  exports: [McpServerFactory],
})
export class McpModule {}
