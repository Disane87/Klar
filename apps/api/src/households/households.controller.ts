import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdMemberGuard } from './guards/household-member.guard';
import { HouseholdsService } from './households.service';

interface RenameBody { name: string }
interface JoinBody { code: string }
interface CreateInviteBody { expiresInDays?: number; maxUses?: number }

@Controller()
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('households')
  listMyHouseholds(@CurrentUser() user: JwtPayload) {
    return this.householdsService.listForUser(user.sub);
  }

  @Post('households/join')
  @HttpCode(HttpStatus.OK)
  joinHousehold(
    @CurrentUser() user: JwtPayload,
    @Body() body: JoinBody,
  ) {
    return this.householdsService.joinByCode(user.sub, body.code);
  }

  @Get('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  getHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.getHousehold(ctx);
  }

  @Patch('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  renameHousehold(
    @ReqContext() ctx: RequestContext,
    @Body() body: RenameBody,
  ) {
    return this.householdsService.rename(ctx, body.name);
  }

  @Get('households/:hid/members')
  @UseGuards(HouseholdMemberGuard)
  listMembers(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listMembers(ctx);
  }

  @Delete('households/:hid/members/:uid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @ReqContext() ctx: RequestContext,
    @Param('uid') targetUserId: string,
  ) {
    return this.householdsService.removeMember(ctx, targetUserId);
  }

  @Get('households/:hid/invites')
  @UseGuards(HouseholdMemberGuard)
  listInvites(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listInvites(ctx);
  }

  @Post('households/:hid/invites')
  @UseGuards(HouseholdMemberGuard)
  createInvite(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateInviteBody,
  ) {
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86_400_000)
      : undefined;
    return this.householdsService.createInvite(ctx, { expiresAt, maxUses: body.maxUses });
  }

  @Delete('households/:hid/invites/:iid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInvite(
    @ReqContext() ctx: RequestContext,
    @Param('iid') inviteId: string,
  ) {
    return this.householdsService.deleteInvite(ctx, inviteId);
  }
}
