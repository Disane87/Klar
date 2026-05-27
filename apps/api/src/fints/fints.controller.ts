import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Sse,
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
  ApiBody,
} from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import {
  FintsService,
  type CreateConnectionInput,
  type PickAccountsInput,
} from './fints.service';
import { TriggerSyncDto } from './dto/trigger-sync.dto';
import { UpdateFintsConnectionDto } from './dto/update-fints-connection.dto';
import {
  FintsBankLookupResponse,
  FintsCapabilitiesResponse,
  FintsConnectionResponse,
  FintsCreateConnectionResponse,
  FintsTriggerSyncResponse,
  FintsSyncRunResponse,
  FintsDiscoveredAccountResponse,
  FintsDeleteImpactResponse,
} from './dto/responses/fints.response';

/**
 * FinTS HTTP surface (Phase 14a.6 backend).
 *
 * Routes are scoped under the existing household path. The full setup
 * happy path is:
 *
 *   1. GET  /banks/lookup?blz=37050198            (resolves bank URL)
 *   2. POST /connections                          (creates + first sync,
 *                                                   returns tanChallenge
 *                                                   if SCA needed)
 *   3. POST /sync-runs/:id/tan                    (resume after TAN)
 *   4. GET  /connections/:id/discovered-accounts  (list bank sub-accounts)
 *   5. POST /connections/:id/accounts             (pick + attach)
 *   6. POST /connections/:id/sync                 (manual trigger from now on)
 *
 * The frontend wizard (14a.6 UI) renders this flow as four wizard steps.
 */
@ApiTags('FinTS · Sync')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID (UUID).', example: 'hh_3f8e-2c1a-...' })
@Controller('households/:hid/fints')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class FintsController {
  constructor(private readonly service: FintsService) {}

  @Get('banks/lookup')
  @ApiOperation({
    summary: 'Look up a bank by BLZ',
    description:
      'Resolves an 8-digit Bankleitzahl to bank metadata (display name, FinTS server URL, BIC). Used by the setup wizard to auto-fill bank details. Read-only.',
  })
  @ApiQuery({ name: 'blz', description: 'German Bankleitzahl (exactly 8 digits).', example: '37050198' })
  @ApiResponse({ status: 200, type: FintsBankLookupResponse })
  @ApiResponse({ status: 400, description: 'BLZ missing or not 8 digits.' })
  @ApiResponse({ status: 404, description: 'Bank not found in registry / no FinTS endpoint.' })
  lookupBank(@Query('blz') blz?: string) {
    if (!blz || !/^[0-9]{8}$/.test(blz)) {
      throw new BadRequestException('blz query parameter must be 8 digits');
    }
    return this.service.lookupBank(blz);
  }

  @Get('banks')
  @ApiOperation({
    summary: 'List all FinTS-capable banks',
    description: 'Returns the searchable bank list used by the setup wizard combobox. Read-only.',
  })
  @ApiResponse({ status: 200, type: [FintsBankLookupResponse] })
  listBanks() {
    return this.service.listBanks();
  }

  @Get('connections')
  @ApiOperation({
    summary: 'List FinTS connections in the household',
    description:
      'Returns all FinTS connections in the household with their attached Klar accounts. PIN/secret material is never returned. Any household member may call this; loginName is anonymized for non-owners.',
  })
  @ApiResponse({ status: 200, type: [FintsConnectionResponse] })
  async listConnections(@ReqContext() ctx: RequestContext) {
    const items = await this.service.list(ctx);
    return items.map(c => this.service.toResponse(c));
  }

  @Get('connections/:id')
  @ApiOperation({
    summary: 'Get one FinTS connection',
    description: 'Returns a single FinTS connection with its attached accounts. Any household member may call this.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiResponse({ status: 200, type: FintsConnectionResponse })
  @ApiResponse({ status: 404, description: 'Connection not found in this household.' })
  async getConnection(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ) {
    const c = await this.service.findOne(ctx, id);
    return this.service.toResponse(c);
  }

  @Post('connections')
  @ApiOperation({
    summary: 'Create a FinTS connection (and run first sync)',
    description:
      'Encrypts the PIN, creates the connection, and immediately triggers the first sync. May take several seconds — runs synchronously. If the bank requires Strong Customer Authentication, the response contains a tanChallenge and the syncRun stays in AWAITING_TAN until POST /sync-runs/:id/tan is called. The caller becomes the connection owner and is the only one who can mutate or delete it.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['bankName', 'blz', 'serverUrl', 'loginName', 'pin'],
      properties: {
        bankName: { type: 'string', example: 'Sparkasse KölnBonn' },
        blz: { type: 'string', example: '37050198' },
        serverUrl: { type: 'string', example: 'https://hbci.example-bank.de/fints' },
        loginName: { type: 'string', example: 'anonlogin' },
        pin: { type: 'string', example: '••••••', description: 'Online-banking PIN; encrypted at rest.' },
        customerId: { type: 'string', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 201, type: FintsCreateConnectionResponse })
  @ApiResponse({ status: 400, description: 'Required fields missing.' })
  @ApiResponse({ status: 401, description: 'Invalid bank credentials.' })
  @ApiResponse({ status: 422, description: 'FinTS handshake failed.' })
  async createConnection(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateConnectionInput,
  ) {
    if (!body.bankName || !body.blz || !body.serverUrl || !body.loginName || !body.pin) {
      throw new BadRequestException(
        'bankName, blz, serverUrl, loginName, and pin are required',
      );
    }
    const result = await this.service.create(ctx, body);
    return {
      connection: this.service.toResponse(result.connection),
      syncRun: this.service.toSyncRunResponse(result.syncRun),
      tanChallenge: result.tanChallenge ?? null,
    };
  }

  @Get('connections/:id/capabilities')
  @ApiOperation({
    summary: 'Get bank-advertised statement-fetch capabilities',
    description:
      'Returns the cached HKKAZ/HKCAZ capabilities extracted from the bank’s BPD after the last successful sync. The wizard’s initial-sync range picker uses `maxLookbackDays` as the upper bound for the date picker; `tanRequiredForStatements` decides whether to render a TAN hint. Fields default to null/false until the first sync has populated the cache. Any household member may read.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiResponse({ status: 200, type: FintsCapabilitiesResponse })
  @ApiResponse({ status: 404, description: 'Connection not found in this household.' })
  getCapabilities(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ) {
    return this.service.getCapabilities(ctx, id);
  }

  @Post('connections/:id/sync')
  @ApiOperation({
    summary: 'Trigger a manual sync',
    description:
      'Queues a manual sync run for this connection. May take several seconds — runs synchronously. Rate-limited per connection (30s cooldown, ignored after a previous FAILED run). Only the connection owner can trigger; subject to SCA expiry which surfaces a tanChallenge. Optional `fromDate`/`toDate` (ISO `YYYY-MM-DD`) override the default lookback window — used by the setup wizard for the initial deep sync.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiBody({ type: TriggerSyncDto, required: false })
  @ApiResponse({ status: 201, type: FintsTriggerSyncResponse })
  @ApiResponse({ status: 400, description: 'Invalid fromDate/toDate (not ISO, fromDate>toDate, fromDate in the future).' })
  @ApiResponse({ status: 403, description: 'Caller is not the connection owner.' })
  @ApiResponse({ status: 404, description: 'Connection not found.' })
  @ApiResponse({ status: 409, description: 'Sync cooldown active (try again in a few seconds).' })
  async triggerSync(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: TriggerSyncDto = {},
  ) {
    const range = this.parseSyncRange(body);
    const result = await this.service.triggerSync(ctx, id, range);
    return {
      syncRun: this.service.toSyncRunResponse(result.syncRun),
      tanChallenge: result.tanChallenge ?? null,
    };
  }

  private parseSyncRange(body: TriggerSyncDto): { fromDate?: Date; toDate?: Date } {
    const fromDate = body.fromDate ? new Date(`${body.fromDate}T00:00:00Z`) : undefined;
    const toDate = body.toDate ? new Date(`${body.toDate}T23:59:59Z`) : undefined;
    const now = new Date();
    if (fromDate && fromDate.getTime() > now.getTime()) {
      throw new BadRequestException('fromDate must not be in the future');
    }
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    return { fromDate, toDate };
  }

  /**
   * Server-Sent Events stream for one sync run. The setup wizard opens this
   * after a decoupled / pushTAN challenge so it can auto-advance to step 4
   * the moment the bank confirms — without the user clicking "Fertig".
   * Authorised via JwtAuthGuard + HouseholdMemberGuard (mounted on the
   * controller); ownership of the underlying FintsConnection is enforced
   * inside the service. EventSource cannot send Authorization headers, so
   * the web client uses fetch+ReadableStream to consume this endpoint.
   */
  @Sse('sync-runs/:id/events')
  @ApiOperation({
    summary: 'Subscribe to sync-run events (SSE)',
    description:
      'Server-Sent Events stream for one sync run. The wizard opens this after a decoupled/pushTAN challenge so it can auto-advance the moment the bank confirms — without the user clicking "Fertig". Only the connection owner may subscribe. EventSource cannot send Authorization headers, so the web client uses fetch+ReadableStream.',
  })
  @ApiParam({ name: 'id', description: 'Sync run ID.', example: 'sr_8a2d-...' })
  @ApiResponse({
    status: 200,
    description: 'text/event-stream of FintsRunEvent payloads ({type, syncRunId, ...}).',
  })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  @ApiResponse({ status: 404, description: 'Sync run not found.' })
  async syncRunEvents(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    return this.service.streamSyncRunEvents(ctx, id);
  }

  @Post('sync-runs/:id/tan')
  @ApiOperation({
    summary: 'Submit a TAN to resume a sync',
    description:
      'Resumes a sync run that is in AWAITING_TAN. For decoupled / pushTAN flows pass an empty string — the bank-side confirmation is enough. Only the connection owner may call this.',
  })
  @ApiParam({ name: 'id', description: 'Sync run ID.', example: 'sr_8a2d-...' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tan: { type: 'string', description: 'TAN code (or empty string for decoupled flows).', example: '123456' },
      },
    },
  })
  @ApiResponse({ status: 201, type: FintsTriggerSyncResponse })
  @ApiResponse({ status: 401, description: 'TAN rejected by bank.' })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  @ApiResponse({ status: 404, description: 'Sync run not found.' })
  async submitTan(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { tan?: string },
  ) {
    const result = await this.service.submitTan(ctx, id, body?.tan ?? '');
    return {
      syncRun: this.service.toSyncRunResponse(result.syncRun),
      tanChallenge: result.tanChallenge ?? null,
    };
  }

  @Get('connections/:id/discovered-accounts')
  @ApiOperation({
    summary: 'List sub-accounts discovered at the bank',
    description:
      'Returns the list of FinTS sub-accounts the bank exposes for this connection. Step 4 of the wizard. Only the connection owner may call this.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiResponse({ status: 200, type: [FintsDiscoveredAccountResponse] })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  async discoveredAccounts(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ) {
    return this.service.listDiscoveredAccounts(ctx, id);
  }

  @Post('connections/:id/accounts')
  @ApiOperation({
    summary: 'Pick & attach sub-accounts to Klar',
    description:
      'Step 5 of the wizard: persists the user-selected discovered accounts as Klar Account rows linked to this connection. Existing attachments are kept; new ones are inserted. Only the connection owner may call this.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['accounts'],
      properties: {
        accounts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['fintsAccountRef'],
            properties: {
              fintsAccountRef: { type: 'string', example: '0532013000' },
              name: { type: 'string', example: 'Sparkasse · Girokonto' },
              iban: { type: 'string', example: 'DE89370400440532013000' },
              bic: { type: 'string', example: 'COLSDE33XXX' },
              visibility: { type: 'string', enum: ['SHARED', 'PRIVATE'], example: 'SHARED' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Newly created or already-attached Klar Account rows.' })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  async attachAccounts(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: PickAccountsInput,
  ) {
    const accounts = await this.service.pickAccounts(ctx, id, body);
    return accounts;
  }

  @Get('connections/:id/delete-impact')
  @ApiOperation({
    summary: 'Preview the impact of deleting a connection',
    description:
      'Returns counts of accounts, transactions and standing orders that would remain (kept) when the connection is deleted. Used by the confirmation dialog. Only the connection owner may call this.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiResponse({ status: 200, type: FintsDeleteImpactResponse })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  async deleteImpact(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<{ accounts: number; transactions: number; standingOrders: number }> {
    return this.service.getDeleteImpact(ctx, id);
  }

  @Patch('connections/:id')
  @ApiOperation({
    summary: 'Update FinTS sync settings',
    description:
      'Updates the per-connection sync interval and/or the syncEnabled kill-switch. Owner-only. Recomputes nextSyncAt from the new interval so the next master tick honours the change.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiBody({ type: UpdateFintsConnectionDto })
  @ApiResponse({ status: 200, description: 'Connection updated.' })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  @ApiResponse({ status: 404, description: 'Connection not found.' })
  async updateConnection(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateFintsConnectionDto,
  ) {
    const updated = await this.service.updateSyncSettings(ctx, id, body);
    return {
      id: updated.id,
      syncInterval: updated.syncInterval,
      syncEnabled: updated.syncEnabled,
      nextSyncAt: updated.nextSyncAt?.toISOString() ?? null,
    };
  }

  @Delete('connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a FinTS connection',
    description:
      'Detaches Klar accounts from the connection and removes encrypted credentials. Existing transactions and standing orders are kept. Only the connection owner may call this.',
  })
  @ApiParam({ name: 'id', description: 'FinTS connection ID.', example: 'fc_8a2d-...' })
  @ApiResponse({ status: 204, description: 'Connection deleted.' })
  @ApiResponse({ status: 403, description: 'Not the connection owner.' })
  @ApiResponse({ status: 404, description: 'Connection not found.' })
  async deleteConnection(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}

