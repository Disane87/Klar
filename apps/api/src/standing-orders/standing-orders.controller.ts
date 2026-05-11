import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { StandingOrderFrequency } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import {
  StandingOrdersService,
  type CreateStandingOrderInput,
  type UpdateStandingOrderInput,
} from './standing-orders.service';
import {
  CreateStandingOrderDto,
  UpdateStandingOrderDto,
} from './dto/create-standing-order.dto';
import { StandingOrderResponse } from './dto/responses/standing-order.response';

@ApiTags('Standing Orders')
@Controller('households/:hid/standing-orders')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class StandingOrdersController {
  constructor(private readonly service: StandingOrdersService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List standing orders',
    description:
      'Returns standing orders (manual + FinTS-derived) for the caller’s household. By default only active rows are returned.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Pass `true` to include paused rows.',
    example: 'false',
  })
  @ApiResponse({ status: 200, type: StandingOrderResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.list(ctx, {
      includeInactive: includeInactive === 'true',
    });
  }

  @Post()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a manual standing order',
    description:
      'Creates a manual standing-order row. FinTS-derived rows are populated by the FinTS sync pipeline and cannot be created via this endpoint.',
  })
  @ApiBody({ type: CreateStandingOrderDto })
  @ApiResponse({ status: 201, type: StandingOrderResponse })
  @ApiResponse({ status: 400, description: 'Invalid frequency or missing required fields.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateStandingOrderDto,
  ) {
    if (!Object.values(StandingOrderFrequency).includes(body.frequency)) {
      throw new BadRequestException('Invalid frequency');
    }
    return this.service.create(ctx, body as CreateStandingOrderInput);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a standing order',
    description:
      'Patches a standing-order row. On `FINTS_DERIVED` rows the bank-derived fields (`counterpartyName`, `counterpartyIban`, `amountCents`, `frequency`, `nextExpectedAt`) are locked and rejected with 400.',
  })
  @ApiParam({
    name: 'id',
    description: 'Standing-order UUID.',
    example: 'so_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  @ApiBody({ type: UpdateStandingOrderDto })
  @ApiResponse({ status: 200, type: StandingOrderResponse })
  @ApiResponse({ status: 400, description: 'Invalid frequency or attempt to mutate a bank-locked field.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Standing order not found in this household.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateStandingOrderDto,
  ) {
    if (body.frequency && !Object.values(StandingOrderFrequency).includes(body.frequency)) {
      throw new BadRequestException('Invalid frequency');
    }
    return this.service.update(ctx, id, body as UpdateStandingOrderInput);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a manual standing order',
    description:
      'Hard-deletes a manual standing order. `FINTS_DERIVED` rows cannot be deleted — pause them via PATCH `isActive=false` instead.',
  })
  @ApiParam({
    name: 'id',
    description: 'Standing-order UUID.',
    example: 'so_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 400, description: 'Attempt to delete a `FINTS_DERIVED` row.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  @ApiResponse({ status: 404, description: 'Standing order not found in this household.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
