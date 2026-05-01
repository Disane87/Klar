import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { CategoriesService } from '../categories/categories.service';
import { TransactionsService } from '../transactions/transactions.service';
import { OverviewService } from '../overview/overview.service';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeyScopeGuard } from './api-key-scope.guard';
import { RequireScope } from './require-scope.decorator';

/**
 * Public read-only API — authenticated via API key (Bearer bgb_live_...).
 * All endpoints require a valid API key with the appropriate scope.
 *
 * Route prefix: /public/v1
 * Note: @Public() disables the global JwtAuthGuard;
 *       ApiKeyAuthGuard takes over instead.
 */
@Controller('public/v1')
@Public()
@UseGuards(ApiKeyAuthGuard, ApiKeyScopeGuard)
export class PublicApiController {
  constructor(
    private readonly overviewService: OverviewService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * GET /public/v1/overview/cashflow?month=YYYY-MM
   * Requires scope: overview:read
   */
  @Get('overview/cashflow')
  @RequireScope('overview:read')
  async getCashflow(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    return this.overviewService.getCashflow(ctx, month);
  }

  /**
   * GET /public/v1/transactions?month=YYYY-MM
   * Requires scope: transactions:read
   */
  @Get('transactions')
  @RequireScope('transactions:read')
  async getTransactions(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    const items = await this.transactionsService.list(ctx, { month });
    return items.map((tx) => this.transactionsService.toResponse(tx));
  }

  /**
   * GET /public/v1/categories
   * Requires scope: categories:read
   */
  @Get('categories')
  @RequireScope('categories:read')
  async getCategories(@ReqContext() ctx: RequestContext) {
    const items = await this.categoriesService.list(ctx);
    return items.map((c) => this.categoriesService.toResponse(c));
  }
}
