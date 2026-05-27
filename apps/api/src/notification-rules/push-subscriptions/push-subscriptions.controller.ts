import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReqContext } from '../../common/decorators/req-context.decorator';
import type { RequestContext } from '../../common/types/request-context.type';
import { HouseholdMemberGuard } from '../../households/guards/household-member.guard';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import {
  PushSubscriptionResponse,
  VapidPublicKeyResponse,
} from './dto/responses/push-subscription.response';

@ApiTags('Notification Rules · Web Push')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID.', example: 'hh_3f8e-...' })
@Controller('households/:hid/push-subscriptions')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class PushSubscriptionsController {
  constructor(private readonly service: PushSubscriptionsService) {}

  @Get('vapid-public-key')
  @ApiOperation({
    summary: 'VAPID public key',
    description:
      'Returns the server\'s VAPID public key (base64url) the frontend passes to PushManager.subscribe(). The public key is not a secret. Empty string when push is not configured server-side.',
  })
  @ApiResponse({ status: 200, type: VapidPublicKeyResponse })
  vapidKey(): VapidPublicKeyResponse {
    return { publicKey: this.service.vapidPublicKey() };
  }

  @Get()
  @ApiOperation({
    summary: 'List the caller\'s push subscriptions',
    description: 'Used by the "Manage devices" UI under Settings → Notifications.',
  })
  @ApiResponse({ status: 200, isArray: true, type: PushSubscriptionResponse })
  async list(@ReqContext() ctx: RequestContext) {
    const subs = await this.service.list(ctx);
    return subs.map(s => this.service.toResponse(s));
  }

  @Post()
  @ApiOperation({
    summary: 'Subscribe / refresh push subscription',
    description:
      'Upserts a subscription keyed by the push service endpoint. Idempotent — re-subscribing on the same device updates the keys rather than creating a duplicate.',
  })
  @ApiBody({ type: SubscribePushDto })
  @ApiResponse({ status: 201, type: PushSubscriptionResponse })
  async subscribe(@ReqContext() ctx: RequestContext, @Body() dto: SubscribePushDto) {
    const sub = await this.service.subscribe(ctx, dto);
    return this.service.toResponse(sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a push subscription',
    description: 'Disables push to a single device for the calling user.',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID.', example: 'sub_3a8d-...' })
  @ApiResponse({ status: 204, description: 'Subscription removed.' })
  @ApiResponse({ status: 404, description: 'Subscription not found or not yours.' })
  async remove(@ReqContext() ctx: RequestContext, @Param('id') id: string): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
