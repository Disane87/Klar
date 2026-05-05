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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

interface UpdateProfileBody { displayName?: string; email?: string }
interface ChangePasswordBody { currentPassword: string; newPassword: string }
interface UploadAvatarBody { data: string }

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getProfile(payload.sub);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() payload: JwtPayload,
    @Body() body: UpdateProfileBody,
  ) {
    return this.usersService.updateProfile(payload.sub, body);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() body: ChangePasswordBody,
  ) {
    return this.usersService.changePassword(
      payload.sub,
      body.currentPassword,
      body.newPassword,
      payload.refreshTokenId,
    );
  }

  @Get('me/sessions')
  listSessions(@CurrentUser() payload: JwtPayload) {
    return this.usersService.listSessions(payload.sub, payload.refreshTokenId);
  }

  @Delete('me/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeAllSessions(@CurrentUser() payload: JwtPayload) {
    return this.usersService.revokeAllSessionsExcept(payload.sub, payload.refreshTokenId);
  }

  @Delete('me/sessions/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param('tokenId') tokenId: string,
  ) {
    return this.usersService.revokeSession(payload.sub, tokenId);
  }

  @Delete('me/oidc/:identityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkOidc(
    @CurrentUser() payload: JwtPayload,
    @Param('identityId') identityId: string,
  ) {
    return this.usersService.unlinkOidc(payload.sub, identityId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(@CurrentUser() payload: JwtPayload) {
    return this.usersService.deleteAccount(payload.sub);
  }

  @Post('me/avatar')
  async uploadAvatar(
    @CurrentUser() payload: JwtPayload,
    @Body() body: UploadAvatarBody,
  ): Promise<{ avatarUrl: string }> {
    if (!body?.data) throw new BadRequestException('Kein Bild übermittelt');
    return this.usersService.uploadAvatar(payload.sub, body.data);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAvatar(@CurrentUser() payload: JwtPayload): Promise<void> {
    return this.usersService.deleteAvatar(payload.sub);
  }
}
