import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { BudgetsService } from './budgets.service';
import type { UpsertBudgetInput } from './budgets.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { BudgetResponse } from './dto/responses/budget.response';

@ApiTags('Budgets')
@Controller('households/:hid/budgets')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List budgets',
    description:
      'Returns budgets for the caller’s household. Filter by `month` (`YYYY-MM` or `YYYY-MM-DD`, normalized to `YYYY-MM-01`) and/or `categoryId`.',
  })
  @ApiQuery({ name: 'month', required: false, description: 'Budget month — `YYYY-MM` or `YYYY-MM-DD`.', example: '2026-05' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Category UUID filter.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 200, type: BudgetResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const items = await this.service.list(ctx, { month, categoryId });
    return items.map(b => this.service.toResponse(b));
  }

  @Put()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Upsert a budget for (category, month)',
    description:
      'Creates or updates the budget for the given (category, normalized-month) pair. The month is always stored as the first day of the month (`YYYY-MM-01`).',
  })
  @ApiBody({ type: UpsertBudgetDto })
  @ApiResponse({ status: 200, type: BudgetResponse })
  @ApiResponse({ status: 400, description: 'Missing required fields or non-positive `amountCents`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async upsert(
    @ReqContext() ctx: RequestContext,
    @Body() body: UpsertBudgetDto,
  ) {
    if (!body.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    if (!body.month) throw new BadRequestException('month ist erforderlich');
    if (body.amountCents === undefined || body.amountCents === null) {
      throw new BadRequestException('amountCents ist erforderlich');
    }

    const item = await this.service.upsert(ctx, body as UpsertBudgetInput);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a budget',
    description: 'Hard-deletes a single budget row by ID, scoped to the caller’s household.',
  })
  @ApiParam({ name: 'id', description: 'Budget UUID.', example: 'bd_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Budget not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
