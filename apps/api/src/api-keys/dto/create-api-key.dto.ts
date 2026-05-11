import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { API_KEY_SCOPES, type ApiKeyScope } from '../api-key-scopes';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Human-readable name shown in the API keys list. Helps the user remember which integration owns the key.',
    example: 'n8n production automation',
    minLength: 1,
    maxLength: 80,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    description: 'List of permission scopes this key is allowed to use against the public API.',
    example: ['transactions:read', 'budgets:read'],
    isArray: true,
    enum: API_KEY_SCOPES,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(API_KEY_SCOPES as readonly string[], { each: true })
  scopes!: ApiKeyScope[];

  @ApiProperty({
    description: 'Optional ISO-8601 expiration timestamp. Once reached, the key stops authenticating.',
    example: '2027-01-01T00:00:00.000Z',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @ApiProperty({
    description: 'Optional rate limit in requests per minute (default 60).',
    example: 60,
    required: false,
    minimum: 1,
    maximum: 6000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6000)
  rateLimitPerMin?: number;
}

export class ApiKeyListItemResponse {
  @ApiProperty({ description: 'API key ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  id!: string;

  @ApiProperty({ description: 'Display name.', example: 'n8n production automation' })
  name!: string;

  @ApiProperty({ description: 'Granted scopes.', example: ['transactions:read'], type: [String] })
  scopes!: string[];

  @ApiProperty({ description: 'Expiration (ISO 8601) or null if non-expiring.', example: '2027-01-01T00:00:00.000Z', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ description: 'Last successful authentication (ISO 8601) or null.', example: '2026-05-09T08:12:00.000Z', nullable: true })
  lastUsedAt!: string | null;

  @ApiProperty({ description: 'Per-minute rate limit.', example: 60 })
  rateLimitPerMin!: number;

  @ApiProperty({ description: 'Whether the key has been revoked.', example: false })
  isRevoked!: boolean;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601).', example: '2026-04-15T10:00:00.000Z' })
  createdAt!: string;
}

export class CreateApiKeyResponse extends ApiKeyListItemResponse {
  @ApiProperty({
    description: 'Full API key string. Returned ONCE on creation — copy it now, it cannot be retrieved again. Format: bgb_live_<80 hex>.',
    example: 'bgb_live_7f9a2b3c8d1e4f5a9b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a',
  })
  fullKey!: string;
}
