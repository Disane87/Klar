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
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { OAuthService } from './oauth.service';

/**
 * Settings-UI-Endpoints für "Verbundene Apps".
 *
 * Authentifizierung über den globalen JwtAuthGuard (Klar-Session-Token —
 * NICHT MCP-Token). User sieht nur eigene Grants, kann sie revoken.
 */
@Controller('oauth/grants')
export class OAuthGrantsController {
  constructor(private readonly service: OAuthService) {}

  @Get()
  list(@Req() req: FastifyRequest & { user: JwtPayload }): Promise<unknown[]> {
    return this.service.listUserGrants(req.user.sub) as Promise<unknown[]>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  async rename(
    @Req() req: FastifyRequest & { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { displayName?: string | null },
  ): Promise<void> {
    await this.service.renameClient(req.user.sub, id, body.displayName ?? null);
  }
}
