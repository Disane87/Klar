import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountsService, type UpdateAccountInput } from './accounts.service';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponse } from './dto/responses/account.response';
import { PurgeTransactionsResponse } from './dto/responses/purge-transactions.response';

@ApiTags('Accounts')
@Controller('households/:hid/accounts')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List accounts in the household',
    description:
      'Returns every account (csv_only + fints) attached to the caller’s household, including archived ones. Caller must be a member of the household.',
  })
  @ApiResponse({ status: 200, type: AccountResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async list(@ReqContext() ctx: RequestContext) {
    const items = await this.service.list(ctx.householdId);
    return items.map((a) => this.service.toResponse(a));
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update an account',
    description:
      'Patches name / visibility / archivedAt / syncEnabled on an account scoped to the caller’s household. FinTS-owned accounts may only be modified by their owner — others get 403.',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID.',
    example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  @ApiResponse({ status: 200, type: AccountResponse })
  @ApiResponse({ status: 400, description: 'Invalid payload (e.g. name length, visibility value).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not a household member, or not the FinTS-account owner.',
  })
  @ApiResponse({ status: 404, description: 'Account not found in this household.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateAccountDto,
  ) {
    const item = await this.service.update(ctx, id, body as UpdateAccountInput);
    return this.service.toResponse(item);
  }

  @Delete(':id/transactions')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete all transactions of an account',
    description:
      'Removes every transaction row attached to the given account, drops the FinTS-derived standing-order detections and clears the cached HKSAL balance. Useful to recover from orphaned bookings left behind by older sync versions. FinTS accounts may only be purged by their owner. The next sync repopulates the account from the connection’s sync window.',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID.',
    example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  @ApiResponse({ status: 200, type: PurgeTransactionsResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not a household member, or not the FinTS-account owner.',
  })
  @ApiResponse({ status: 404, description: 'Account not found in this household.' })
  async purgeTransactions(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<PurgeTransactionsResponse> {
    return this.service.purgeTransactions(ctx, id);
  }
}
