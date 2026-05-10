import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AccountsService, type UpdateAccountInput } from './accounts.service';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';

@Controller('households/:hid/accounts')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  async list(@ReqContext() ctx: RequestContext) {
    const items = await this.service.list(ctx.householdId);
    return items.map((a) => this.service.toResponse(a));
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateAccountInput,
  ) {
    const item = await this.service.update(ctx, id, body);
    return this.service.toResponse(item);
  }
}
