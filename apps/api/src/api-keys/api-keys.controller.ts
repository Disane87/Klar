import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ApiKeysService, type CreateApiKeyInput } from './api-keys.service';

@Controller('households/:hid/api-keys')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  async list(@ReqContext() ctx: RequestContext) {
    return this.service.list(ctx);
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateApiKeyInput,
  ) {
    return this.service.create(ctx, body);
  }

  /**
   * Revoke an API key (soft-delete: marks isRevoked=true).
   * Using DELETE /:id/revoke for semantic clarity.
   */
  @Delete(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.revoke(ctx, id);
  }

  /**
   * Hard-delete an API key from the database.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
