import {
  Controller,
  Get,
  Post,
  Patch,
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
import { RecurringFrequency, Visibility } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { RecurringTransactionsService } from './recurring-transactions.service';
import type {
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
} from './recurring-transactions.service';

@Controller('households/:hid/recurring-transactions')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class RecurringTransactionsController {
  constructor(private readonly service: RecurringTransactionsService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('categoryId') categoryId?: string,
    @Query('projectId') projectId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveParsed =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const items = await this.service.list(ctx, {
      categoryId,
      projectId,
      isActive: isActiveParsed,
    });
    return items.map(rt => this.service.toResponse(rt));
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateRecurringTransactionInput,
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (body.amountCents === undefined || body.amountCents === null) {
      throw new BadRequestException('amountCents ist erforderlich');
    }
    if (!body.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    if (!body.frequency || !Object.values(RecurringFrequency).includes(body.frequency)) {
      throw new BadRequestException('Ungültige frequency');
    }
    if (!body.startDate) throw new BadRequestException('startDate ist erforderlich');
    if (body.visibility && !Object.values(Visibility).includes(body.visibility)) {
      throw new BadRequestException('Ungültige visibility');
    }

    const item = await this.service.create(ctx, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateRecurringTransactionInput,
  ) {
    if (body.frequency && !Object.values(RecurringFrequency).includes(body.frequency)) {
      throw new BadRequestException('Ungültige frequency');
    }
    if (body.visibility && !Object.values(Visibility).includes(body.visibility)) {
      throw new BadRequestException('Ungültige visibility');
    }

    const item = await this.service.update(ctx, id, body);
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

  @Patch(':id/active')
  async setActive(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    if (typeof body.isActive !== 'boolean') {
      throw new BadRequestException('isActive muss ein Boolean sein');
    }
    const item = await this.service.setActive(ctx, id, body.isActive);
    return this.service.toResponse(item);
  }
}
