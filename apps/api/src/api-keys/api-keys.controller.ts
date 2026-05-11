import {
  Controller,
  Get,
  Post,
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
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ApiKeysService } from './api-keys.service';
import {
  ApiKeyListItemResponse,
  CreateApiKeyDto,
  CreateApiKeyResponse,
} from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
@Controller('households/:hid/api-keys')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @ApiOperation({
    summary: 'List API keys for a household',
    description: 'Returns metadata for every API key in the household — never the secret. Only members of the household can call this.',
  })
  @ApiResponse({ status: 200, description: 'API keys.', type: ApiKeyListItemResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async list(@ReqContext() ctx: RequestContext) {
    return this.service.list(ctx);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new API key',
    description: 'Generates a new key (Argon2id-hashed at rest) and returns the full key string ONCE. Copy it immediately — it cannot be retrieved again. Used to authenticate requests against the public /api/public/v1 endpoints via the X-API-Key header.',
  })
  @ApiResponse({ status: 201, description: 'Key created.', type: CreateApiKeyResponse })
  @ApiResponse({ status: 400, description: 'Validation failed (missing name, invalid scopes, bad expiresAt).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateApiKeyDto,
  ) {
    return this.service.create(ctx, body);
  }

  /**
   * Revoke an API key (soft-delete: marks isRevoked=true).
   * Using DELETE /:id/revoke for semantic clarity.
   */
  @Delete(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke an API key (soft delete)',
    description: 'Marks the key as revoked. The key stops authenticating immediately but stays in the list with isRevoked=true so the user can see it was once active.',
  })
  @ApiParam({ name: 'id', description: 'API key ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Key revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async revoke(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.revoke(ctx, id);
  }

  /**
   * Hard-delete an API key from the database.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete an API key',
    description: 'Hard-deletes the key from the database. Prefer the /revoke variant unless you really need to remove the audit trail.',
  })
  @ApiParam({ name: 'id', description: 'API key ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Key deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
