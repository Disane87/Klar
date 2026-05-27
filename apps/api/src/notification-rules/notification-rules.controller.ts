import {
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
import { NotificationRulesService } from './notification-rules.service';
import { CreateNotificationRuleDto } from './dto/create-notification-rule.dto';
import { UpdateNotificationRuleDto } from './dto/update-notification-rule.dto';
import { PreviewNotificationRuleDto } from './dto/preview-notification-rule.dto';
import {
  NotificationRulePreviewResponse,
  NotificationRuleResponse,
  NotificationRuleTestResponse,
  RuleActivityListResponse,
} from './dto/responses/notification-rule.response';

@ApiTags('Notification Rules')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID.', example: 'hh_3f8e-...' })
@Controller('households/:hid/notification-rules')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class NotificationRulesController {
  constructor(private readonly service: NotificationRulesService) {}

  @Get()
  @ApiOperation({
    summary: 'List notification rules',
    description:
      'Returns every rule owned by the caller in this household, newest first.',
  })
  @ApiResponse({ status: 200, isArray: true, type: NotificationRuleResponse })
  async list(@ReqContext() ctx: RequestContext) {
    const rules = await this.service.list(ctx);
    return rules.map(r => this.service.toResponse(r));
  }

  @Post()
  @ApiOperation({
    summary: 'Create a notification rule',
    description:
      'Validates the predicate against the trigger field whitelist before saving. PRIVATE-aware: rules see only the owner\'s PRIVATE transactions.',
  })
  @ApiBody({ type: CreateNotificationRuleDto })
  @ApiResponse({ status: 201, type: NotificationRuleResponse })
  @ApiResponse({ status: 400, description: 'Predicate or schedule invalid for the chosen trigger.' })
  async create(@ReqContext() ctx: RequestContext, @Body() dto: CreateNotificationRuleDto) {
    const rule = await this.service.create(ctx, dto);
    return this.service.toResponse(rule);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single rule' })
  @ApiParam({ name: 'id', description: 'Rule ID.', example: 'nrl_3a8d-...' })
  @ApiResponse({ status: 200, type: NotificationRuleResponse })
  @ApiResponse({ status: 404, description: 'Rule not found or not owned by caller.' })
  async findOne(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    const rule = await this.service.findOne(ctx, id);
    return this.service.toResponse(rule);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule' })
  @ApiParam({ name: 'id', description: 'Rule ID.', example: 'nrl_3a8d-...' })
  @ApiBody({ type: UpdateNotificationRuleDto })
  @ApiResponse({ status: 200, type: NotificationRuleResponse })
  @ApiResponse({ status: 400, description: 'Predicate invalid for new trigger.' })
  @ApiResponse({ status: 404, description: 'Rule not found or not owned by caller.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationRuleDto,
  ) {
    const rule = await this.service.update(ctx, id, dto);
    return this.service.toResponse(rule);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a rule' })
  @ApiParam({ name: 'id', description: 'Rule ID.', example: 'nrl_3a8d-...' })
  @ApiResponse({ status: 204, description: 'Rule deleted.' })
  @ApiResponse({ status: 404, description: 'Rule not found or not owned by caller.' })
  async remove(@ReqContext() ctx: RequestContext, @Param('id') id: string): Promise<void> {
    await this.service.remove(ctx, id);
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Dry-run a predicate',
    description:
      'Evaluates the predicate against the last 90 days of household transactions and returns how often it would have fired. Currently supports TRANSACTION_CREATED only.',
  })
  @ApiBody({ type: PreviewNotificationRuleDto })
  @ApiResponse({ status: 200, type: NotificationRulePreviewResponse })
  @ApiResponse({ status: 400, description: 'Trigger not supported or predicate invalid.' })
  async preview(@ReqContext() ctx: RequestContext, @Body() dto: PreviewNotificationRuleDto) {
    return this.service.preview(ctx, dto);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Send a test notification',
    description:
      'Dispatches a hand-crafted test notification through every channel enabled on the rule.',
  })
  @ApiParam({ name: 'id', description: 'Rule ID.', example: 'nrl_3a8d-...' })
  @ApiResponse({ status: 200, type: NotificationRuleTestResponse })
  @ApiResponse({ status: 404, description: 'Rule not found or not owned by caller.' })
  async test(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    const channels = await this.service.test(ctx, id);
    return { dispatched: channels.length > 0, channels };
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Recent rule firings',
    description: 'Returns up to 200 recent fires (rule activity log) for the caller.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (1–200, default 50).',
    example: 50,
  })
  @ApiResponse({ status: 200, type: RuleActivityListResponse })
  async activity(@ReqContext() ctx: RequestContext, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : undefined;
    const fires = await this.service.activity(
      ctx,
      Number.isFinite(n) && n! > 0 ? Math.min(n!, 200) : 50,
    );
    return { items: fires.map(f => this.service.toActivityResponse(f)) };
  }
}
