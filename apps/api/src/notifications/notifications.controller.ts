import {
  Controller,
  Get,
  Patch,
  Delete,
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
import { NotificationsService } from './notifications.service';

@Controller('households/:hid/notifications')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      const n = Number(limit);
      if (!Number.isInteger(n) || n <= 0 || n > 100) {
        throw new BadRequestException('limit muss zwischen 1 und 100 liegen');
      }
      parsedLimit = n;
    }
    return this.service.list(ctx, {
      cursor,
      limit: parsedLimit,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.markRead(ctx, id);
  }

  @Patch('read-all')
  async markAllRead(@ReqContext() ctx: RequestContext) {
    return this.service.markAllRead(ctx);
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
