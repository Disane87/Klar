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
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import {
  StandingOrdersService,
  type CreateStandingOrderInput,
  type UpdateStandingOrderInput,
} from './standing-orders.service';

@Controller('households/:hid/standing-orders')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class StandingOrdersController {
  constructor(private readonly service: StandingOrdersService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.list(ctx, {
      includeInactive: includeInactive === 'true',
    });
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateStandingOrderInput,
  ) {
    if (!Object.values(StandingOrderFrequency).includes(body.frequency)) {
      throw new BadRequestException('Invalid frequency');
    }
    return this.service.create(ctx, body);
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateStandingOrderInput,
  ) {
    if (body.frequency && !Object.values(StandingOrderFrequency).includes(body.frequency)) {
      throw new BadRequestException('Invalid frequency');
    }
    return this.service.update(ctx, id, body);
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
