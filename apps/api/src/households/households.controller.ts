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
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdRole } from '@prisma/client';
import { HouseholdMemberGuard } from './guards/household-member.guard';
import { HouseholdsService } from './households.service';

interface RenameBody { name: string }
interface CreateInviteLinkBody { expiresInDays?: number }
interface SendInviteEmailBody { email: string }

@Controller()
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('households')
  listMyHouseholds(@CurrentUser() user: JwtPayload) {
    return this.householdsService.listForUser(user.sub);
  }

  @Get('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  getHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.getHousehold(ctx);
  }

  @Patch('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  renameHousehold(@ReqContext() ctx: RequestContext, @Body() body: RenameBody) {
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
  removeMember(@ReqContext() ctx: RequestContext, @Param('uid') targetUserId: string) {
    return this.householdsService.removeMember(ctx, targetUserId);
  }

  @Patch('households/:hid/members/:uid')
  @UseGuards(HouseholdMemberGuard)
  changeMemberRole(
    @ReqContext() ctx: RequestContext,
    @Param('uid') targetUserId: string,
    @Body() body: { role: 'OWNER' | 'MEMBER' },
  ) {
    const role = body.role === 'OWNER' ? HouseholdRole.OWNER : HouseholdRole.MEMBER;
    return this.householdsService.changeRole(ctx, targetUserId, role);
  }

  // ─── Invitation Links ────────────────────────────────────────────────────

  @Get('households/:hid/invites')
  @UseGuards(HouseholdMemberGuard)
  listInvites(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listInviteLinks(ctx);
  }

  @Post('households/:hid/invites')
  @UseGuards(HouseholdMemberGuard)
  createInvite(@ReqContext() ctx: RequestContext, @Body() body: CreateInviteLinkBody) {
    return this.householdsService.createInviteLink(ctx, { expiresInDays: body.expiresInDays });
  }

  @Post('households/:hid/invites/:iid/send')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  sendInviteEmail(
    @ReqContext() ctx: RequestContext,
    @Param('iid') inviteId: string,
    @Body() body: SendInviteEmailBody,
  ) {
    return this.householdsService.sendInviteLinkEmail(ctx, inviteId, body.email);
  }

  @Delete('households/:hid/invites/:iid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInvite(@ReqContext() ctx: RequestContext, @Param('iid') inviteId: string) {
    return this.householdsService.deleteInviteLink(ctx, inviteId);
  }

  // ─── Public: Join by Token ───────────────────────────────────────────────

  @Public()
  @Get('join/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.householdsService.getInviteInfo(token);
  }

  @Post('join/:token')
  @HttpCode(HttpStatus.OK)
  joinByToken(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.householdsService.joinByToken(user.sub, token);
  }

  // ─── Household Lifecycle ─────────────────────────────────────────────────

  @Delete('households/:hid/leave')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.leave(ctx);
  }

  @Delete('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.deleteHousehold(ctx);
  }
}
