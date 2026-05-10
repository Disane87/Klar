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
import { FixedCostSource, FixedCostStatus } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { FixedCostsService } from './fixed-costs.service';
import type {
  CreateFixedCostInput,
  UpdateFixedCostInput,
} from './fixed-costs.service';
import {
  ContractsService,
  type PromoteToContractInput,
  type UpdateContractInput,
} from './contracts.service';

interface BulkStatusBody {
  ids: string[];
  status: FixedCostStatus;
}

@Controller('households/:hid/fixed-costs')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class FixedCostsController {
  constructor(
    private readonly service: FixedCostsService,
    private readonly contracts: ContractsService,
  ) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('contractsOnly') contractsOnly?: string,
  ) {
    const items = await this.service.list(ctx, {
      status: parseStatus(status),
      source: parseSource(source),
      contractsOnly: contractsOnly === 'true' || contractsOnly === '1',
    });
    return items.map(c => this.service.toResponse(c));
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateFixedCostInput,
  ) {
    const item = await this.service.create(ctx, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateFixedCostInput,
  ) {
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

  @Post('recompute')
  @HttpCode(HttpStatus.OK)
  recompute(@ReqContext() ctx: RequestContext) {
    return this.service.recompute(ctx);
  }

  @Post('bulk-status')
  @HttpCode(HttpStatus.OK)
  async bulkStatus(
    @ReqContext() ctx: RequestContext,
    @Body() body: BulkStatusBody,
  ) {
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids muss eine nicht-leere Liste sein');
    }
    if (!body.status || !(body.status in FixedCostStatus)) {
      throw new BadRequestException(`Ungültiger status: ${body.status}`);
    }
    return this.service.bulkUpdateStatus(ctx, body.ids, body.status);
  }

  // ─── Contract extension routes ────────────────────────────────────────

  @Post(':id/contract')
  async promote(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: PromoteToContractInput,
  ) {
    await this.contracts.promote(ctx, id, body);
    const fc = await this.service.list(ctx, {});
    const updated = fc.find(f => f.id === id);
    return updated ? this.service.toResponse(updated) : null;
  }

  @Patch(':id/contract')
  async updateContract(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateContractInput,
  ) {
    await this.contracts.update(ctx, id, body);
    const fc = await this.service.list(ctx, {});
    const updated = fc.find(f => f.id === id);
    return updated ? this.service.toResponse(updated) : null;
  }

  @Delete(':id/contract')
  @HttpCode(HttpStatus.NO_CONTENT)
  async demote(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.contracts.demote(ctx, id);
  }
}

function parseStatus(status?: string): FixedCostStatus | undefined {
  if (!status) return undefined;
  const upper = status.toUpperCase();
  if (!(upper in FixedCostStatus)) {
    throw new BadRequestException(`Ungültiger status: ${status}`);
  }
  return upper as FixedCostStatus;
}

function parseSource(source?: string): FixedCostSource | undefined {
  if (!source) return undefined;
  const upper = source.toUpperCase();
  if (!(upper in FixedCostSource)) {
    throw new BadRequestException(`Ungültiger source: ${source}`);
  }
  return upper as FixedCostSource;
}
