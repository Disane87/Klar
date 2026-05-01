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
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { BudgetsService } from './budgets.service';
import type { UpsertBudgetInput } from './budgets.service';

@Controller('households/:hid/budgets')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('month') month?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const items = await this.service.list(ctx, { month, categoryId });
    return items.map(b => this.service.toResponse(b));
  }

  @Put()
  async upsert(
    @ReqContext() ctx: RequestContext,
    @Body() body: UpsertBudgetInput,
  ) {
    if (!body.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    if (!body.month) throw new BadRequestException('month ist erforderlich');
    if (body.amountCents === undefined || body.amountCents === null) {
      throw new BadRequestException('amountCents ist erforderlich');
    }

    const item = await this.service.upsert(ctx, body);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
