import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Sse,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Observable } from 'rxjs';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import {
  FintsService,
  type CreateConnectionInput,
  type PickAccountsInput,
} from './fints.service';

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
@Controller('households/:hid/fints')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class FintsController {
  constructor(private readonly service: FintsService) {}

  @Get('banks/lookup')
  lookupBank(@Query('blz') blz?: string) {
    if (!blz || !/^[0-9]{8}$/.test(blz)) {
      throw new BadRequestException('blz query parameter must be 8 digits');
    }
    return this.service.lookupBank(blz);
  }

  @Get('banks')
  listBanks() {
    return this.service.listBanks();
  }

  @Get('connections')
  async listConnections(@ReqContext() ctx: RequestContext) {
    const items = await this.service.list(ctx);
    return items.map(c => this.service.toResponse(c));
  }

  @Get('connections/:id')
  async getConnection(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ) {
    const c = await this.service.findOne(ctx, id);
    return this.service.toResponse(c);
  }

  @Post('connections')
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

  @Post('connections/:id/sync')
  async triggerSync(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ) {
    const result = await this.service.triggerSync(ctx, id);
    return {
      syncRun: this.service.toSyncRunResponse(result.syncRun),
      tanChallenge: result.tanChallenge ?? null,
    };
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
  async syncRunEvents(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    return this.service.streamSyncRunEvents(ctx, id);
  }

  @Post('sync-runs/:id/tan')
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
  async discoveredAccounts(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ) {
    return this.service.listDiscoveredAccounts(ctx, id);
  }

  @Post('connections/:id/accounts')
  async attachAccounts(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: PickAccountsInput,
  ) {
    const accounts = await this.service.pickAccounts(ctx, id, body);
    return accounts;
  }

  @Delete('connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConnection(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
