// apps/api/src/data-transfer/data-transfer.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { DataTransferService } from './data-transfer.service';
import type { ConfirmMappings } from './data-transfer.service';

@Controller('households/:hid')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class DataTransferController {
  constructor(private readonly service: DataTransferService) {}

  @Get('export')
  async export(
    @ReqContext() ctx: RequestContext,
    @Query('include') includeRaw: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const include = includeRaw
      ? (includeRaw.split(',').map(s => s.trim()) as ('transactions' | 'recurringTransactions')[])
      : (['transactions', 'recurringTransactions'] as ('transactions' | 'recurringTransactions')[]);

    const data = await this.service.export(ctx, { include, startDate, endDate });
    const date = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="klar-export-${date}.json"`)
      .send(data);
  }

  @Post('import/analyze')
  async analyze(
    @ReqContext() ctx: RequestContext,
    @Body('fileContent') fileContent: string | undefined,
  ) {
    if (!fileContent) throw new BadRequestException('fileContent ist erforderlich');
    return this.service.analyze(ctx, fileContent);
  }

  @Post('import/confirm')
  async confirm(
    @ReqContext() ctx: RequestContext,
    @Body('fileContent') fileContent: string | undefined,
    @Body('categoryMappings') categoryMappings: ConfirmMappings['categoryMappings'] = [],
    @Body('projectMappings') projectMappings: ConfirmMappings['projectMappings'] = [],
  ) {
    if (!fileContent) throw new BadRequestException('fileContent ist erforderlich');
    return this.service.confirm(ctx, fileContent, { categoryMappings, projectMappings });
  }
}
