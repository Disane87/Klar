import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  AvatarResponse,
  ChangePasswordDto,
  UpdateProfileDto,
  UploadAvatarDto,
} from './dto/update-profile.dto';
import { PayrollCalculatorStateDto } from './dto/payroll-calculator-state.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@ApiTags('Users')
@ApiBearerAuth('jwt')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get the current user profile',
    description: 'Returns the full profile of the authenticated user including email, display name, role, avatar URL, and 2FA status.',
  })
  @ApiResponse({ status: 200, description: 'Current user profile.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  getProfile(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getProfile(payload.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update the current user profile',
    description: 'Partially updates display name and/or email. Changing the email triggers a re-verification flow on the new address.',
  })
  @ApiResponse({ status: 200, description: 'Updated user profile.' })
  @ApiResponse({ status: 400, description: 'Validation failed (e.g. invalid email).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 409, description: 'Email already in use by another account.' })
  updateProfile(
    @CurrentUser() payload: JwtPayload,
    @Body() body: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(payload.sub, body);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change the account password',
    description: 'Verifies the current password and replaces it with the new one. All other sessions are revoked; the calling session stays active.',
  })
  @ApiResponse({ status: 204, description: 'Password changed; other sessions revoked.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 401, description: 'Current password incorrect or token invalid.' })
  changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() body: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      payload.sub,
      body.currentPassword,
      body.newPassword,
      payload.refreshTokenId,
    );
  }

  @Get('me/sessions')
  @ApiOperation({
    summary: 'List active sessions for the current user',
    description: 'Returns all active refresh tokens with metadata (IP, user-agent, created/expires) and a flag for the current one.',
  })
  @ApiResponse({ status: 200, description: 'Active sessions.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  listSessions(@CurrentUser() payload: JwtPayload) {
    return this.usersService.listSessions(payload.sub, payload.refreshTokenId);
  }

  @Delete('me/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke all other sessions',
    description: 'Revokes every refresh token of the current user except the calling one. Useful as "log out everywhere else".',
  })
  @ApiResponse({ status: 204, description: 'Other sessions revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  revokeAllSessions(@CurrentUser() payload: JwtPayload) {
    return this.usersService.revokeAllSessionsExcept(payload.sub, payload.refreshTokenId);
  }

  @Delete('me/sessions/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a specific session',
    description: 'Revokes a single refresh token by ID for the current user.',
  })
  @ApiParam({ name: 'tokenId', description: 'Refresh-token (session) ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Session revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Session not found or not owned by the current user.' })
  revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param('tokenId') tokenId: string,
  ) {
    return this.usersService.revokeSession(payload.sub, tokenId);
  }

  @Delete('me/oidc/:identityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unlink an OIDC identity by ID',
    description: 'Removes the link to an external OIDC identity. The user must keep at least one usable login method (password or OIDC).',
  })
  @ApiParam({ name: 'identityId', description: 'OIDC identity row ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Identity unlinked.' })
  @ApiResponse({ status: 400, description: 'Cannot unlink the only remaining login method.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Identity not found or not owned by the current user.' })
  unlinkOidc(
    @CurrentUser() payload: JwtPayload,
    @Param('identityId') identityId: string,
  ) {
    return this.usersService.unlinkOidc(payload.sub, identityId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the current user account',
    description: 'Permanently deletes the user, all sessions, OIDC links, and household memberships owned solely by them. Cannot be undone.',
  })
  @ApiResponse({ status: 204, description: 'Account deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  deleteAccount(@CurrentUser() payload: JwtPayload) {
    return this.usersService.deleteAccount(payload.sub);
  }

  @Post('me/avatar')
  @ApiOperation({
    summary: 'Upload a new avatar',
    description: 'Accepts a base64-encoded data URL, stores it on the server, and returns the public avatar URL. Replaces any existing avatar.',
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded.', type: AvatarResponse })
  @ApiResponse({ status: 400, description: 'Missing or invalid image data.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async uploadAvatar(
    @CurrentUser() payload: JwtPayload,
    @Body() body: UploadAvatarDto,
  ): Promise<{ avatarUrl: string }> {
    if (!body?.data) throw new BadRequestException('Kein Bild übermittelt');
    return this.usersService.uploadAvatar(payload.sub, body.data);
  }

  @Get('me/payroll-calculator-state')
  @ApiOperation({
    summary: 'Get the saved Gehaltsrechner input snapshot',
    description: 'Returns the user-scoped Gehaltsrechner state (positions, tax class, KV/PV settings, optional add-ons) or `null` when no snapshot has been saved yet.',
  })
  @ApiResponse({ status: 200, description: 'Saved snapshot or null.', type: PayrollCalculatorStateDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  getPayrollCalculatorState(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getPayrollCalculatorState(payload.sub);
  }

  @Patch('me/payroll-calculator-state')
  @ApiOperation({
    summary: 'Save the Gehaltsrechner input snapshot',
    description: 'Stores the current Gehaltsrechner inputs so the form can be rehydrated on the next visit. Replaces any previous snapshot in full (PUT-style).',
  })
  @ApiResponse({ status: 200, description: 'Snapshot stored.', type: PayrollCalculatorStateDto })
  @ApiResponse({ status: 400, description: 'Validation failed (e.g. invalid Bundesland or out-of-range value).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  savePayrollCalculatorState(
    @CurrentUser() payload: JwtPayload,
    @Body() body: PayrollCalculatorStateDto,
  ) {
    return this.usersService.savePayrollCalculatorState(payload.sub, body);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove the current avatar',
    description: 'Deletes the stored avatar file and clears the URL on the user profile.',
  })
  @ApiResponse({ status: 204, description: 'Avatar removed.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  deleteAvatar(@CurrentUser() payload: JwtPayload): Promise<void> {
    return this.usersService.deleteAvatar(payload.sub);
  }
}
