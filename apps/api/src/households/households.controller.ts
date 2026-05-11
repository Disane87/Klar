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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdRole } from '@prisma/client';
import { HouseholdMemberGuard } from './guards/household-member.guard';
import { HouseholdsService } from './households.service';
import {
  HouseholdSummaryResponse,
  HouseholdMemberResponse,
  HouseholdInviteLinkResponse,
  HouseholdInviteInfoResponse,
  JoinHouseholdResponse,
} from './dto/responses/households.response';

interface RenameBody { name: string }
interface UpdateNoteBody { note: string | null }
interface CreateInviteLinkBody { expiresInDays?: number }
interface SendInviteEmailBody { email: string }

@ApiTags('Households')
@Controller()
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('households')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List households of the current user',
    description: 'Returns every household the authenticated user is a member of, with their role.',
  })
  @ApiResponse({ status: 200, type: [HouseholdSummaryResponse] })
  listMyHouseholds(@CurrentUser() user: JwtPayload) {
    return this.householdsService.listForUser(user.sub);
  }

  @Get('households/:hid')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID (UUID).', example: 'hh_3f8e-...' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'Get one household',
    description: 'Returns metadata for a single household. Any household member may call this.',
  })
  @ApiResponse({ status: 200, type: HouseholdSummaryResponse })
  @ApiResponse({ status: 403, description: 'Not a member of the household.' })
  @ApiResponse({ status: 404, description: 'Household not found.' })
  getHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.getHousehold(ctx);
  }

  @Patch('households/:hid')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'Rename a household',
    description: 'Updates the household display name. Owner-only.',
  })
  @ApiBody({ schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', example: 'Familie Franke' } } } })
  @ApiResponse({ status: 200, type: HouseholdSummaryResponse })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  renameHousehold(@ReqContext() ctx: RequestContext, @Body() body: RenameBody) {
    return this.householdsService.rename(ctx, body.name);
  }

  @Patch('households/:hid/note')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'Update the household note',
    description: 'Updates the free-form household note (markdown). Pass null to clear. Any member may edit.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        note: { type: 'string', nullable: true, example: '## Notizen\n- gemeinsamer Pott\n- Stand 2026-05' },
      },
    },
  })
  @ApiResponse({ status: 200, type: HouseholdSummaryResponse })
  updateNote(@ReqContext() ctx: RequestContext, @Body() body: UpdateNoteBody) {
    return this.householdsService.updateNote(ctx, body?.note ?? null);
  }

  @Get('households/:hid/members')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'List household members',
    description: 'Returns all members of the household with their role and join date.',
  })
  @ApiResponse({ status: 200, type: [HouseholdMemberResponse] })
  listMembers(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listMembers(ctx);
  }

  @Delete('households/:hid/members/:uid')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @ApiParam({ name: 'uid', description: 'Target user ID to remove.', example: 'usr_3f8e-...' })
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a member from the household',
    description: 'Removes another user. Owner-only. Cannot remove the last owner — use DELETE /households/:hid instead.',
  })
  @ApiResponse({ status: 204, description: 'Member removed.' })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  @ApiResponse({ status: 409, description: 'Cannot remove the last owner.' })
  removeMember(@ReqContext() ctx: RequestContext, @Param('uid') targetUserId: string) {
    return this.householdsService.removeMember(ctx, targetUserId);
  }

  @Patch('households/:hid/members/:uid')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @ApiParam({ name: 'uid', description: 'Target user ID.', example: 'usr_3f8e-...' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'Change a member\'s role',
    description: 'Promotes or demotes a member to OWNER/MEMBER. Owner-only. Demoting the last owner is rejected.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role'],
      properties: { role: { type: 'string', enum: ['OWNER', 'MEMBER'], example: 'MEMBER' } },
    },
  })
  @ApiResponse({ status: 200, type: HouseholdMemberResponse })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  @ApiResponse({ status: 409, description: 'Would demote the last owner.' })
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
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'List invite links',
    description: 'Returns all (active and used) invite links of the household. Any member may call.',
  })
  @ApiResponse({ status: 200, type: [HouseholdInviteLinkResponse] })
  listInvites(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listInviteLinks(ctx);
  }

  @Post('households/:hid/invites')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @ApiOperation({
    summary: 'Create an invite link',
    description:
      'Generates a single-use invite link. Owner-only. Pass expiresInDays to set an expiry; omit for the default (7 days).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        expiresInDays: { type: 'integer', minimum: 1, maximum: 90, example: 14 },
      },
    },
  })
  @ApiResponse({ status: 201, type: HouseholdInviteLinkResponse })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  createInvite(@ReqContext() ctx: RequestContext, @Body() body: CreateInviteLinkBody) {
    return this.householdsService.createInviteLink(ctx, { expiresInDays: body.expiresInDays });
  }

  @Post('households/:hid/invites/:iid/send')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @ApiParam({ name: 'iid', description: 'Invite link ID.', example: 'inv_3f8e-...' })
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Email an invite link',
    description: 'Queues an email containing the invite link to the given address. Owner-only. Side effect: sends mail via the configured SMTP transport.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', example: 'partner@example.com' } },
    },
  })
  @ApiResponse({ status: 204, description: 'Email queued.' })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  sendInviteEmail(
    @ReqContext() ctx: RequestContext,
    @Param('iid') inviteId: string,
    @Body() body: SendInviteEmailBody,
  ) {
    return this.householdsService.sendInviteLinkEmail(ctx, inviteId, body.email);
  }

  @Delete('households/:hid/invites/:iid')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @ApiParam({ name: 'iid', description: 'Invite link ID.' })
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke an invite link',
    description: 'Permanently revokes an invite link. Owner-only. Used links can also be deleted to clean up history.',
  })
  @ApiResponse({ status: 204, description: 'Invite revoked.' })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  deleteInvite(@ReqContext() ctx: RequestContext, @Param('iid') inviteId: string) {
    return this.householdsService.deleteInviteLink(ctx, inviteId);
  }

  // ─── Public: Join by Token ───────────────────────────────────────────────

  @Public()
  @Get('join/:token')
  @ApiOperation({
    summary: 'Preview an invite token (public)',
    description:
      'Public endpoint that returns the household + inviter display name for a given invite token. Used by the join page to render a confirmation screen before the user signs in. Does NOT consume the invite.',
  })
  @ApiParam({ name: 'token', description: 'Opaque invite token.', example: 'tok_3f8e-...' })
  @ApiResponse({ status: 200, type: HouseholdInviteInfoResponse })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  getInviteInfo(@Param('token') token: string) {
    return this.householdsService.getInviteInfo(token);
  }

  @Post('join/:token')
  @ApiBearerAuth('jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join a household via invite token',
    description: 'Consumes the invite token and adds the authenticated user as a MEMBER of the household. Idempotent if already a member.',
  })
  @ApiParam({ name: 'token', description: 'Opaque invite token.', example: 'tok_3f8e-...' })
  @ApiResponse({ status: 200, type: JoinHouseholdResponse })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  @ApiResponse({ status: 409, description: 'Invite already used or expired.' })
  joinByToken(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.householdsService.joinByToken(user.sub, token);
  }

  // ─── Household Lifecycle ─────────────────────────────────────────────────

  @Delete('households/:hid/leave')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Leave a household',
    description: 'Removes the calling user from the household. Rejected if the caller is the last owner — promote another member or delete the household instead.',
  })
  @ApiResponse({ status: 204, description: 'Left successfully.' })
  @ApiResponse({ status: 409, description: 'Last owner cannot leave.' })
  leaveHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.leave(ctx);
  }

  @Delete('households/:hid')
  @ApiBearerAuth('jwt')
  @ApiParam({ name: 'hid', description: 'Household ID.' })
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a household',
    description:
      'Permanently deletes the household and all its data (transactions, recurring transactions, projects, categories, invites, FinTS connections). Owner-only. Irreversible — there is no soft-delete.',
  })
  @ApiResponse({ status: 204, description: 'Household deleted.' })
  @ApiResponse({ status: 403, description: 'Caller is not the household owner.' })
  deleteHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.deleteHousehold(ctx);
  }
}
