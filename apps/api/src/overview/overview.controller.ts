import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { OverviewService } from './overview.service';
import {
  FixedCostsResponse,
  CashflowResponse,
  ProjectsOverviewResponse,
  BudgetsVsActualsResponse,
} from './dto/responses/overview.response';

@ApiTags('Overview & Analytics')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID (UUID).', example: 'hh_3f8e-2c1a-...' })
@Controller('households/:hid/overview')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  @Get('fixed-costs')
  @ApiOperation({
    summary: 'Get fixed costs grouped by category',
    description:
      'Returns all active recurring transactions for the requested month, grouped by category, with monthly-equivalent amounts (quarterly/yearly normalized). Read-only. PRIVATE recurring transactions of other users are excluded. Any household member may call this.',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Target month in YYYY-MM. Defaults to the current month when omitted.',
    example: '2026-05',
  })
  @ApiResponse({ status: 200, type: FixedCostsResponse })
  @ApiResponse({ status: 400, description: 'Month parameter is malformed (not YYYY-MM).' })
  async getFixedCosts(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    return this.service.getFixedCosts(ctx, month);
  }

  @Get('cashflow')
  @ApiOperation({
    summary: 'Get monthly cashflow summary',
    description:
      'Returns the per-month cashflow split between recurring and ad-hoc transactions, plus totals and surplus. Read-only. PRIVATE entries of other users are excluded. Any household member may call this.',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Target month in YYYY-MM. Defaults to current month.',
    example: '2026-05',
  })
  @ApiResponse({ status: 200, type: CashflowResponse })
  @ApiResponse({ status: 400, description: 'Month parameter is malformed.' })
  async getCashflow(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    return this.service.getCashflow(ctx, month);
  }

  @Get('budgets-vs-actuals')
  @ApiOperation({
    summary: 'Get per-category budget vs. actual',
    description:
      'Returns Soll-vs-Ist per category for the month: target budget compared to realized transactions plus monthly-equivalent recurring amounts. Read-only. Any household member may call this.',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Target month in YYYY-MM. Defaults to current month.',
    example: '2026-05',
  })
  @ApiResponse({ status: 200, type: BudgetsVsActualsResponse })
  @ApiResponse({ status: 400, description: 'Month parameter is malformed.' })
  async getBudgetsVsActuals(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
  ) {
    return this.service.getBudgetsVsActuals(ctx, month);
  }

  @Get('projects')
  @ApiOperation({
    summary: 'Get project overview totals',
    description:
      'Returns each visible project with realized spend/income, planned amounts, deviation and transaction count. Read-only. PRIVATE entries of other users are excluded from totals. Any household member may call this.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by project status. Defaults to ACTIVE.',
    enum: ['ACTIVE', 'ARCHIVED', 'PLANNED'],
    example: 'ACTIVE',
  })
  @ApiResponse({ status: 200, type: ProjectsOverviewResponse })
  async getProjects(
    @ReqContext() ctx: RequestContext,
    @Query('status') status?: string,
  ) {
    return this.service.getProjects(ctx, status);
  }
}
