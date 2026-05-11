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
import { RecurringFrequency, Visibility } from '@prisma/client';
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
import { RecurringTransactionsService } from './recurring-transactions.service';
import type {
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
} from './recurring-transactions.service';
import {
  BulkPauseDto,
  BulkPauseResponse,
  CreateRecurringTransactionDto,
  SetActiveDto,
  UpdateRecurringTransactionDto,
} from './dto/create-recurring-transaction.dto';
import { RecurringTransactionResponse } from './dto/responses/recurring-transaction.response';

@ApiTags('Recurring Transactions')
@Controller('households/:hid/recurring-transactions')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class RecurringTransactionsController {
  constructor(private readonly service: RecurringTransactionsService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List recurring-transaction templates',
    description:
      'Returns recurring templates visible to the caller in the current household. PRIVATE rows of other users are filtered out. Recurring transactions are computed on-the-fly — they are not persisted.',
  })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project UUID.', example: 'prj_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'isActive', required: false, description: '`true` for active-only, `false` for paused-only.', example: 'true' })
  @ApiResponse({ status: 200, type: RecurringTransactionResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('categoryId') categoryId?: string,
    @Query('projectId') projectId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveParsed =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const items = await this.service.list(ctx, {
      categoryId,
      projectId,
      isActive: isActiveParsed,
    });
    return items.map(rt => this.service.toResponse(rt));
  }

  @Post()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a recurring-transaction template',
    description:
      'Creates a recurring template that drives the on-the-fly forecast. `dayOfMonth` is clamped to month-end via `safeDayOfMonth()` for short months.',
  })
  @ApiBody({ type: CreateRecurringTransactionDto })
  @ApiResponse({ status: 201, type: RecurringTransactionResponse })
  @ApiResponse({ status: 400, description: 'Missing/invalid `name`, `amountCents`, `categoryId`, `frequency`, `startDate`, or `visibility`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateRecurringTransactionDto,
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (body.amountCents === undefined || body.amountCents === null) {
      throw new BadRequestException('amountCents ist erforderlich');
    }
    if (!body.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    if (!body.frequency || !Object.values(RecurringFrequency).includes(body.frequency)) {
      throw new BadRequestException('Ungültige frequency');
    }
    if (!body.startDate) throw new BadRequestException('startDate ist erforderlich');
    if (body.visibility && !Object.values(Visibility).includes(body.visibility)) {
      throw new BadRequestException('Ungültige visibility');
    }

    const item = await this.service.create(ctx, body as CreateRecurringTransactionInput);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a recurring-transaction template',
    description:
      'Patches a recurring template by ID. PRIVATE templates can only be edited by their creator.',
  })
  @ApiParam({ name: 'id', description: 'Recurring template UUID.', example: 'rt_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: UpdateRecurringTransactionDto })
  @ApiResponse({ status: 200, type: RecurringTransactionResponse })
  @ApiResponse({ status: 400, description: 'Invalid `frequency` or `visibility`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Not allowed to mutate this template.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateRecurringTransactionDto,
  ) {
    if (body.frequency && !Object.values(RecurringFrequency).includes(body.frequency)) {
      throw new BadRequestException('Ungültige frequency');
    }
    if (body.visibility && !Object.values(Visibility).includes(body.visibility)) {
      throw new BadRequestException('Ungültige visibility');
    }

    const item = await this.service.update(ctx, id, body as UpdateRecurringTransactionInput);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a recurring-transaction template',
    description:
      'Hard-deletes the recurring template. Already-booked transactions referencing this template keep their `recurringTransactionId` link.',
  })
  @ApiParam({ name: 'id', description: 'Recurring template UUID.', example: 'rt_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Not allowed to delete this template.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }

  @Patch(':id/active')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Toggle a template active/paused',
    description:
      'Convenience flag toggle without re-sending the entire body. Inactive templates are excluded from the forecast and cashflow projections.',
  })
  @ApiParam({ name: 'id', description: 'Recurring template UUID.', example: 'rt_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: SetActiveDto })
  @ApiResponse({ status: 200, type: RecurringTransactionResponse })
  @ApiResponse({ status: 400, description: '`isActive` must be a boolean.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Not allowed to mutate this template.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  async setActive(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: SetActiveDto,
  ) {
    if (typeof body.isActive !== 'boolean') {
      throw new BadRequestException('isActive muss ein Boolean sein');
    }
    const item = await this.service.setActive(ctx, id, body.isActive);
    return this.service.toResponse(item);
  }

  @Post('bulk-pause')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Bulk-pause / bulk-resume templates',
    description:
      'Default action: pause (`isActive=false`). Pass `isActive=true` to bulk-resume. Per-row authorization: PRIVATE templates of other users are silently skipped.',
  })
  @ApiBody({ type: BulkPauseDto })
  @ApiResponse({ status: 201, type: BulkPauseResponse })
  @ApiResponse({ status: 400, description: 'Missing `ids` array.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async bulkPause(
    @ReqContext() ctx: RequestContext,
    @Body() body: BulkPauseDto,
  ): Promise<{ count: number }> {
    if (!Array.isArray(body?.ids)) throw new BadRequestException('ids muss ein Array sein');
    const isActive = body.isActive === true ? true : false;
    return this.service.bulkSetActive(ctx, body.ids, isActive);
  }
}
