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
import { ContractStatus } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ContractsService } from './contracts.service';
import type {
  CreateContractInput,
  UpdateContractInput,
} from './contracts.service';

@Controller('households/:hid/contracts')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('status') status?: string,
  ) {
    let parsedStatus: ContractStatus | undefined;
    if (status) {
      const upper = status.toUpperCase();
      if (!(upper in ContractStatus)) {
        throw new BadRequestException(`Ungültiger status: ${status}`);
      }
      parsedStatus = upper as ContractStatus;
    }
    const items = await this.service.list(ctx, { status: parsedStatus });
    return items.map(c => this.service.toResponse(c));
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateContractInput,
  ) {
    const item = await this.service.create(ctx, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateContractInput,
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
  async recompute(@ReqContext() ctx: RequestContext) {
    return this.service.recompute(ctx);
  }
}
