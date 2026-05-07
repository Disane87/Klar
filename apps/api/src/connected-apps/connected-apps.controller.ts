import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { ConnectedAppsService } from './connected-apps.service';
import type {
  CreateConnectedAppInput,
  UpdateConnectedAppInput,
} from './connected-apps.service';

@Controller('me/connected-apps')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class ConnectedAppsController {
  constructor(private readonly service: ConnectedAppsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    const items = await this.service.list(user.sub);
    return items.map(c => this.service.toResponse(c));
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateConnectedAppInput,
  ) {
    const item = await this.service.create(user.sub, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateConnectedAppInput,
  ) {
    const item = await this.service.update(user.sub, id, body);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.unlink(user.sub, id);
  }
}
