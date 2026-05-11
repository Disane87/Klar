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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { NotificationsService } from './notifications.service';
import {
  NotificationListResponse,
  MarkAllReadResponse,
} from './dto/responses/notifications.response';

@ApiTags('Notifications')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID (UUID).', example: 'hh_3f8e-2c1a-...' })
@Controller('households/:hid/notifications')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description:
      'Returns the recipient\'s notifications in this household, newest first, cursor-paginated. Read-only. The unreadCount field reflects all unread notifications, not just the current page.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque cursor returned as nextCursor by the previous page.',
    example: '2026-05-08T12:00:00.000Z|ntf_98a2-...',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (1–100, default 20).', example: 20 })
  @ApiQuery({ name: 'unreadOnly', required: false, description: 'Pass "true" to only return unread items.', example: 'false' })
  @ApiResponse({ status: 200, type: NotificationListResponse })
  @ApiResponse({ status: 400, description: 'limit not in range 1–100.' })
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
  @ApiOperation({
    summary: 'Mark a notification as read',
    description:
      'Sets readAt on a single notification belonging to the caller. Idempotent. Only the recipient may call this.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID.', example: 'ntf_2a8d-...' })
  @ApiResponse({ status: 204, description: 'Notification marked as read (or already was).' })
  @ApiResponse({ status: 404, description: 'Notification not found or not yours.' })
  async markRead(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.markRead(ctx, id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all of the caller\'s notifications as read',
    description: 'Bulk-sets readAt on every unread notification of the caller in this household.',
  })
  @ApiResponse({ status: 200, type: MarkAllReadResponse })
  async markAllRead(@ReqContext() ctx: RequestContext) {
    return this.service.markAllRead(ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a notification',
    description: 'Permanently removes a notification owned by the caller. Only the recipient may call this.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID.', example: 'ntf_2a8d-...' })
  @ApiResponse({ status: 204, description: 'Notification deleted.' })
  @ApiResponse({ status: 404, description: 'Notification not found or not yours.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
