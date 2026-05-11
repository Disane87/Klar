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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { ConnectedAppsService } from './connected-apps.service';
import {
  ConnectedAppResponse,
  CreateConnectedAppDto,
  UpdateConnectedAppDto,
} from './dto/connected-app.dto';

@ApiTags('Connected Apps')
@ApiBearerAuth('jwt')
@Controller('me/connected-apps')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class ConnectedAppsController {
  constructor(private readonly service: ConnectedAppsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the user\'s connected apps',
    description: 'Returns all third-party integrations the current user has linked (Home Assistant, n8n, Zapier, Claude, …). Used by the Settings → Integrations page.',
  })
  @ApiResponse({ status: 200, description: 'Connected apps.', type: ConnectedAppResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async list(@CurrentUser() user: JwtPayload) {
    const items = await this.service.list(user.sub);
    return items.map(c => this.service.toResponse(c));
  }

  @Post()
  @ApiOperation({
    summary: 'Link a new connected app',
    description: 'Creates a new connection between the user and a third-party integration. Provider must be one of the supported keys.',
  })
  @ApiResponse({ status: 201, description: 'Connection created.', type: ConnectedAppResponse })
  @ApiResponse({ status: 400, description: 'Validation failed (unknown provider, missing externalId).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 409, description: 'This (provider, externalId) is already linked.' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateConnectedAppDto,
  ) {
    const item = await this.service.create(user.sub, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a connected app',
    description: 'Updates mutable fields (currently only the scope list) of an existing connection.',
  })
  @ApiParam({ name: 'id', description: 'Connected app ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 200, description: 'Updated connection.', type: ConnectedAppResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Connection not found or not owned by the current user.' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateConnectedAppDto,
  ) {
    const item = await this.service.update(user.sub, id, body);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unlink a connected app',
    description: 'Removes the connection. The third-party integration loses access immediately and must be re-linked to be used again.',
  })
  @ApiParam({ name: 'id', description: 'Connected app ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Connection removed.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Connection not found or not owned by the current user.' })
  async unlink(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.unlink(user.sub, id);
  }
}
