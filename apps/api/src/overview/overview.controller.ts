import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { OverviewService } from './overview.service';

@Controller('households/:hid/overview')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  /**
   * GET /api/v1/households/:hid/overview/fixed-costs?month=YYYY-MM
   *
   * Returns all active recurring transactions grouped by category,
   * with monthly-equivalent amounts.
   */
  @Get('fixed-costs')
  async getFixedCosts(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    return this.service.getFixedCosts(ctx, month);
  }

  /**
   * GET /api/v1/households/:hid/overview/cashflow?month=YYYY-MM
   *
   * Returns the monthly cashflow overview (recurring + ad-hoc transactions).
   */
  @Get('cashflow')
  async getCashflow(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    return this.service.getCashflow(ctx, month);
  }

  /**
   * GET /api/v1/households/:hid/overview/projects?status=ACTIVE
   *
   * Returns all visible projects with their transaction totals.
   */
  @Get('projects')
  async getProjects(
    @ReqContext() ctx: RequestContext,
    @Query('status') status?: string,
  ) {
    return this.service.getProjects(ctx, status);
  }
}
