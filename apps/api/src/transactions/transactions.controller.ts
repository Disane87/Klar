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
import { Visibility } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { TransactionsService } from './transactions.service';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from './transactions.service';

@Controller('households/:hid/transactions')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('categoryId') categoryId?: string,
    @Query('projectId') projectId?: string,
    @Query('month') month?: string,
    @Query('isPlanned') isPlanned?: string,
  ) {
    const planned = isPlanned === undefined ? undefined : isPlanned === 'true';
    const items = await this.service.list(ctx, { categoryId, projectId, month, isPlanned: planned });
    return items.map(tx => this.service.toResponse(tx));
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateTransactionInput,
  ) {
    if (body.amountCents === undefined || body.amountCents === null) {
      throw new BadRequestException('amountCents ist erforderlich');
    }
    if (!body.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    if (!body.date) throw new BadRequestException('date ist erforderlich');
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
    @Body() body: UpdateTransactionInput,
  ) {
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

  @Post('bulk-move')
  async bulkMove(
    @ReqContext() ctx: RequestContext,
    @Body() body: { ids: string[]; categoryId: string },
  ): Promise<{ count: number }> {
    if (!Array.isArray(body?.ids)) throw new BadRequestException('ids muss ein Array sein');
    if (!body?.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    return this.service.bulkMove(ctx, body.ids, body.categoryId);
  }

  @Delete('bulk')
  async bulkRemove(
    @ReqContext() ctx: RequestContext,
    @Body() body: { ids: string[] },
  ): Promise<{ count: number }> {
    if (!Array.isArray(body?.ids)) throw new BadRequestException('ids muss ein Array sein');
    return this.service.bulkDelete(ctx, body.ids);
  }
}
