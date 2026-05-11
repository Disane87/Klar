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
import { Visibility } from '@prisma/client';
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
import { TransactionsService } from './transactions.service';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from './transactions.service';
import {
  BulkCountResponse,
  BulkDeleteTransactionsDto,
  BulkMoveTransactionsDto,
  BulkSetVisibilityDto,
  CreateTransactionDto,
  UpdateTransactionDto,
} from './dto/create-transaction.dto';
import { TransactionResponse } from './dto/responses/transaction.response';

@ApiTags('Transactions')
@Controller('households/:hid/transactions')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List transactions',
    description:
      'Returns transactions visible to the caller in the current household. PRIVATE transactions of other users are filtered out. All filters are optional and combinable.',
  })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project UUID.', example: 'prj_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Filter by account UUID.', example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by booking month `YYYY-MM`.', example: '2026-05' })
  @ApiQuery({ name: 'isPlanned', required: false, description: '`true` for planned-only, `false` for booked-only, omitted for both.', example: 'false' })
  @ApiResponse({ status: 200, type: TransactionResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('categoryId') categoryId?: string,
    @Query('projectId') projectId?: string,
    @Query('accountId') accountId?: string,
    @Query('month') month?: string,
    @Query('isPlanned') isPlanned?: string,
  ) {
    const planned = isPlanned === undefined ? undefined : isPlanned === 'true';
    const items = await this.service.list(ctx, {
      categoryId,
      projectId,
      accountId,
      month,
      isPlanned: planned,
    });
    return items.map(tx => this.service.toResponse(tx));
  }

  @Post()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a transaction',
    description:
      'Creates a manual transaction in the household. If `accountId` is omitted, the household’s default csv_only account is used. PRIVATE rows are only visible to their creator.',
  })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, type: TransactionResponse })
  @ApiResponse({ status: 400, description: 'Missing/invalid `amountCents`, `categoryId`, `date`, or `visibility`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateTransactionDto,
  ) {
    if (body.amountCents === undefined || body.amountCents === null) {
      throw new BadRequestException('amountCents ist erforderlich');
    }
    if (!body.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    if (!body.date) throw new BadRequestException('date ist erforderlich');
    if (body.visibility && !Object.values(Visibility).includes(body.visibility)) {
      throw new BadRequestException('Ungültige visibility');
    }

    const item = await this.service.create(ctx, body as CreateTransactionInput);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a transaction',
    description:
      'Patches a transaction by ID. FinTS-imported rows have certain bank-derived fields locked (see `bankFieldsLockedAt`). PRIVATE rows can only be edited by their creator.',
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID.', example: '6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({ status: 200, type: TransactionResponse })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Not allowed to mutate this transaction.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
  ) {
    if (body.visibility && !Object.values(Visibility).includes(body.visibility)) {
      throw new BadRequestException('Ungültige visibility');
    }

    const item = await this.service.update(ctx, id, body as UpdateTransactionInput);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a transaction',
    description:
      'Hard-deletes the transaction. PRIVATE rows can only be deleted by their creator.',
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID.', example: '6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Not allowed to delete this transaction.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }

  @Post('bulk-move')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Bulk-move transactions to a different category',
    description:
      'Re-categorizes every transaction in `ids` (subject to per-row authorization). Returns the count of rows actually moved — silently filtered rows are not counted.',
  })
  @ApiBody({ type: BulkMoveTransactionsDto })
  @ApiResponse({ status: 201, type: BulkCountResponse })
  @ApiResponse({ status: 400, description: 'Missing `ids` array or `categoryId`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async bulkMove(
    @ReqContext() ctx: RequestContext,
    @Body() body: BulkMoveTransactionsDto,
  ): Promise<{ count: number }> {
    if (!Array.isArray(body?.ids)) throw new BadRequestException('ids muss ein Array sein');
    if (!body?.categoryId) throw new BadRequestException('categoryId ist erforderlich');
    return this.service.bulkMove(ctx, body.ids, body.categoryId);
  }

  @Patch('bulk-visibility')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Bulk-set visibility on transactions (PRIVATE / SHARED)',
    description:
      'Switches selected transactions between PRIVATE (only the creator sees them in lists and aggregates) and SHARED (visible to every household member). PRIVATE rows of other users are silently filtered out — a user cannot unilaterally expose someone else’s PRIVATE rows. Bank-locked rows are included, since visibility is not part of the bank-locked field set.',
  })
  @ApiBody({ type: BulkSetVisibilityDto })
  @ApiResponse({ status: 200, type: BulkCountResponse })
  @ApiResponse({ status: 400, description: 'Missing `ids` or invalid `visibility`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async bulkSetVisibility(
    @ReqContext() ctx: RequestContext,
    @Body() body: BulkSetVisibilityDto,
  ): Promise<{ count: number }> {
    if (!Array.isArray(body?.ids)) throw new BadRequestException('ids muss ein Array sein');
    if (body.visibility !== Visibility.PRIVATE && body.visibility !== Visibility.SHARED) {
      throw new BadRequestException('visibility muss PRIVATE oder SHARED sein');
    }
    return this.service.bulkSetVisibility(ctx, body.ids, body.visibility);
  }

  @Delete('bulk')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Bulk-delete transactions',
    description:
      'Hard-deletes every transaction in `ids` the caller is allowed to delete. PRIVATE rows of other users are silently skipped.',
  })
  @ApiBody({ type: BulkDeleteTransactionsDto })
  @ApiResponse({ status: 200, type: BulkCountResponse })
  @ApiResponse({ status: 400, description: 'Missing or non-array `ids`.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async bulkRemove(
    @ReqContext() ctx: RequestContext,
    @Body() body: BulkDeleteTransactionsDto,
  ): Promise<{ count: number }> {
    if (!Array.isArray(body?.ids)) throw new BadRequestException('ids muss ein Array sein');
    return this.service.bulkDelete(ctx, body.ids);
  }
}
