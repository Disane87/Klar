import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@klar/shared';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findByIdOrThrow(payload.sub);
    return this.usersService.toAuthUser(user);
  }
}
