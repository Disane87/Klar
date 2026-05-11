import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { OAuthService } from './oauth.service';
import { RenameGrantDto } from './dto/rename-grant.dto';

/**
 * Settings-UI-Endpoints für "Verbundene Apps".
 *
 * Authentifizierung über den globalen JwtAuthGuard (Klar-Session-Token —
 * NICHT MCP-Token). User sieht nur eigene Grants, kann sie revoken.
 */
@ApiTags('OAuth Server · Grants')
@ApiBearerAuth('jwt')
@Controller('oauth/grants')
export class OAuthGrantsController {
  constructor(private readonly service: OAuthService) {}

  @Get()
  @ApiOperation({
    summary: 'List the user\'s OAuth grants',
    description: 'Returns all OAuth clients the current Klar user has approved access for ("Connected Apps" in Settings → Security).',
  })
  @ApiResponse({
    status: 200,
    description: 'Active grants for the current user.',
    schema: {
      example: [
        {
          id: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c',
          clientId: 'klar_8d9e0f1a2b3c',
          clientName: 'Claude Desktop',
          scopes: ['transactions:read'],
          createdAt: '2026-04-01T10:00:00.000Z',
          lastUsedAt: '2026-05-09T08:12:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  list(@Req() req: FastifyRequest & { user: JwtPayload }): Promise<unknown[]> {
    return this.service.listUserGrants(req.user.sub) as Promise<unknown[]>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke an OAuth grant',
    description: 'Revokes the grant and all access/refresh tokens issued under it. The client must go through the consent flow again to reconnect.',
  })
  @ApiParam({ name: 'id', description: 'Grant ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Grant revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Grant not found or not owned by the current user.' })
  async revoke(
    @Req() req: FastifyRequest & { user: JwtPayload },
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.revokeUserGrant(req.user.sub, id);
  }

  /**
   * Setzt den User-Display-Namen für den Client, dem dieser Grant gehört.
   * `displayName: null` (oder leerer String) resettet auf den Original-Namen
   * aus der OAuth-Registration / das via clientInfo auto-detected ist.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Rename the client behind a grant',
    description: 'Sets a per-user display name for the OAuth client this grant belongs to. Pass displayName: null to reset to the original registration name.',
  })
  @ApiParam({ name: 'id', description: 'Grant ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Display name updated.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Grant not found or not owned by the current user.' })
  async rename(
    @Req() req: FastifyRequest & { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: RenameGrantDto,
  ): Promise<void> {
    await this.service.renameClient(req.user.sub, id, body.displayName ?? null);
  }
}
