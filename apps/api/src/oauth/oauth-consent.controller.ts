import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { HouseholdsRepository } from '../households/households.repository';
import { OAuthService, type ConsentInfo, type IssuedAuthCode } from './oauth.service';
import { OAuthExceptionFilter } from './oauth-exception.filter';
import { ConsentInfoResponse, IssuedAuthCodeResponse } from './dto/rename-grant.dto';

/**
 * Authentifizierter Companion zum public `/oauth2/authorize`.
 *
 * Das Frontend ruft diese Endpoints aus der Consent-Page auf, um:
 * 1. Den aktuellen Authorize-Request zu beschreiben (Client-Logo, Scopes …)
 * 2. Approve/Deny zu submitten und die finale Redirect-URL zu erhalten.
 *
 * Liegt unter `/api/v1/oauth/consent` (mit globalem Prefix), nutzt den
 * normalen `JwtAuthGuard` und benötigt eine aktive Household-Mitgliedschaft.
 */
@ApiTags('OAuth Server · Consent')
@ApiBearerAuth('jwt')
@Controller('oauth/consent')
@UseFilters(OAuthExceptionFilter)
export class OAuthConsentController {
  constructor(
    private readonly service: OAuthService,
    private readonly householdsRepo: HouseholdsRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Describe a pending authorize request',
    description: 'Called by the SPA consent page with the original /oauth2/authorize query parameters. Returns the client metadata, the requested scopes, and whether the same combination is already approved.',
  })
  @ApiResponse({ status: 200, description: 'Consent details.', type: ConsentInfoResponse })
  @ApiResponse({ status: 400, description: 'Invalid authorize request (unknown client_id, bad redirect_uri, …).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getConsentInfo(
    @Query() query: Record<string, string | undefined>,
    @Req() req: FastifyRequest & { user: JwtPayload },
  ): Promise<ConsentInfo> {
    const userId = req.user.sub;
    return this.service.describeAuthorizeRequest(query, userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Approve or deny a consent request',
    description: 'Called by the SPA when the user clicks Approve or Deny. On approve, issues an authorization code and returns the final redirect URL the SPA should navigate to. On deny, returns a redirect URL with error=access_denied.',
  })
  @ApiResponse({ status: 200, description: 'Final redirect URL for the browser.', type: IssuedAuthCodeResponse })
  @ApiResponse({ status: 400, description: 'Invalid request body or no active household membership.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async decide(
    @Body() body: Record<string, unknown>,
    @Req() req: FastifyRequest & { user: JwtPayload },
  ): Promise<IssuedAuthCode> {
    const userId = req.user.sub;
    const memberships = await this.householdsRepo.findMembershipsByUser(userId);
    if (memberships.length === 0) {
      throw new BadRequestException(
        'User ist in keinem aktiven Haushalt — Consent nicht möglich',
      );
    }
    // Im Klar-MVP gehört jeder User typischerweise zu genau einem Haushalt.
    // Wir nehmen den ältesten (deterministisch) als aktiven Kontext für den
    // OAuth-Grant. Multi-Household-Picker im Consent-UI ist für später geplant.
    const householdId = memberships[0].householdId;
    return this.service.decideConsent(body, { userId, householdId });
  }
}
