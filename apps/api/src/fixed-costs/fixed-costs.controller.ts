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
import {
  BulkStatusDto,
  BulkUpdateCountResponse,
  CreateFixedCostDto,
  PromoteToContractDto,
  RecomputeResponse,
  UpdateContractDto,
  UpdateFixedCostDto,
} from './dto/create-fixed-cost.dto';
import { FixedCostResponse } from './dto/responses/fixed-cost.response';

interface BulkStatusBody {
  ids: string[];
  status: FixedCostStatus;
}

@ApiTags('Fixed Costs')
@Controller('households/:hid/fixed-costs')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class FixedCostsController {
  constructor(
    private readonly service: FixedCostsService,
    private readonly contracts: ContractsService,
  ) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List fixed costs',
    description:
      'Returns fixed-cost rows (manual + auto-detected) for the caller’s household. Filter by lifecycle `status`, `source` (`MANUAL` / `AUTO_DETECTED`), or `contractsOnly=true` to limit to promoted contracts.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Lifecycle status filter.', example: 'CONFIRMED' })
  @ApiQuery({ name: 'source', required: false, description: 'Origin filter.', example: 'AUTO_DETECTED' })
  @ApiQuery({ name: 'contractsOnly', required: false, description: 'Pass `true`/`1` to limit to rows with a contract extension.', example: 'false' })
  @ApiResponse({ status: 200, type: FixedCostResponse, isArray: true })
  @ApiResponse({ status: 400, description: 'Invalid `status` or `source` value.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
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
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a manual fixed-cost row',
    description:
      'Creates a `MANUAL`-sourced fixed-cost entry. Auto-detected rows are produced by `POST /recompute` and cannot be created via this endpoint.',
  })
  @ApiBody({ type: CreateFixedCostDto })
  @ApiResponse({ status: 201, type: FixedCostResponse })
  @ApiResponse({ status: 400, description: 'Validation failed (missing name / amount / cycle).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateFixedCostDto,
  ) {
    const item = await this.service.create(ctx, body as CreateFixedCostInput);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a fixed-cost row',
    description:
      'Patches a fixed-cost row by ID. Some bank-derived fields on AUTO_DETECTED rows may be locked.',
  })
  @ApiParam({ name: 'id', description: 'Fixed-cost UUID.', example: 'fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: UpdateFixedCostDto })
  @ApiResponse({ status: 200, type: FixedCostResponse })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Fixed-cost row not found.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateFixedCostDto,
  ) {
    const item = await this.service.update(ctx, id, body as UpdateFixedCostInput);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a fixed-cost row',
    description:
      'Hard-deletes a fixed-cost row. Auto-detection runs may re-create it on the next `POST /recompute` if the underlying transaction pattern still matches.',
  })
  @ApiParam({ name: 'id', description: 'Fixed-cost UUID.', example: 'fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Fixed-cost row not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }

  @Post('recompute')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Re-run fixed-cost detection',
    description:
      'Replaces every `CANDIDATE` (auto-detected) row with the freshly detected set, based on current transactions. Manual rows and confirmed rows are untouched.',
  })
  @ApiResponse({ status: 200, type: RecomputeResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  recompute(@ReqContext() ctx: RequestContext) {
    return this.service.recompute(ctx);
  }

  @Post('bulk-status')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Bulk-update lifecycle status',
    description:
      'Sets the same `status` on every row in `ids`. Useful for confirming a batch of `CANDIDATE` rows after detection.',
  })
  @ApiBody({ type: BulkStatusDto })
  @ApiResponse({ status: 200, type: BulkUpdateCountResponse })
  @ApiResponse({ status: 400, description: 'Empty `ids` or invalid `status`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
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
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Promote a fixed cost to a tracked contract',
    description:
      'Attaches a 1:1 Contract extension (provider, contract number, cancellation deadline, …) to a fixed-cost row. Idempotent: re-posting updates the existing contract.',
  })
  @ApiParam({ name: 'id', description: 'Fixed-cost UUID.', example: 'fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: PromoteToContractDto })
  @ApiResponse({ status: 201, type: FixedCostResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Fixed-cost row not found.' })
  async promote(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: PromoteToContractDto,
  ) {
    await this.contracts.promote(ctx, id, body as PromoteToContractInput);
    const fc = await this.service.list(ctx, {});
    const updated = fc.find(f => f.id === id);
    return updated ? this.service.toResponse(updated) : null;
  }

  @Patch(':id/contract')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a contract extension',
    description: 'Patches the Contract attached to a fixed-cost row.',
  })
  @ApiParam({ name: 'id', description: 'Fixed-cost UUID.', example: 'fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: UpdateContractDto })
  @ApiResponse({ status: 200, type: FixedCostResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Fixed-cost row or contract not found.' })
  async updateContract(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateContractDto,
  ) {
    await this.contracts.update(ctx, id, body as UpdateContractInput);
    const fc = await this.service.list(ctx, {});
    const updated = fc.find(f => f.id === id);
    return updated ? this.service.toResponse(updated) : null;
  }

  @Delete(':id/contract')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Demote / detach a contract',
    description:
      'Removes the Contract extension from a fixed-cost row. The fixed-cost row itself remains.',
  })
  @ApiParam({ name: 'id', description: 'Fixed-cost UUID.', example: 'fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Contract detached.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Fixed-cost row or contract not found.' })
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
