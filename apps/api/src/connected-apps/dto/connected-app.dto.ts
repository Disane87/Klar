import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const PROVIDERS = [
  'pocketid',
  'github',
  'google',
  'claude_ai',
  'home_assistant',
  'n8n',
  'zapier',
  'custom',
] as const;

export class CreateConnectedAppDto {
  @ApiProperty({
    description: 'Provider key. One of the supported integrations.',
    example: 'home_assistant',
    enum: PROVIDERS,
  })
  @IsString()
  @MinLength(1)
  provider!: string;

  @ApiProperty({
    description: 'Provider-side identifier the user wants to link (e.g. account ID, workspace slug, instance URL).',
    example: 'homeassistant.local',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalId!: string;

  @ApiProperty({
    description: 'Optional list of permission scopes granted to the integration.',
    example: ['transactions:read'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(32)
  scopes?: string[];
}

export class UpdateConnectedAppDto {
  @ApiProperty({
    description: 'New scope list (replaces the existing one).',
    example: ['transactions:read', 'budgets:read'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(32)
  scopes?: string[];
}

export class ConnectedAppResponse {
  @ApiProperty({ description: 'Connected app ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  id!: string;

  @ApiProperty({ description: 'Provider key.', example: 'home_assistant' })
  provider!: string;

  @ApiProperty({ description: 'Provider-side identifier.', example: 'homeassistant.local' })
  externalId!: string;

  @ApiProperty({ description: 'Granted scopes.', example: ['transactions:read'], type: [String] })
  scopes!: string[];

  @ApiProperty({ description: 'When the link was created (ISO 8601).', example: '2026-04-01T10:00:00.000Z' })
  linkedAt!: string;

  @ApiProperty({
    description: 'Last time the integration successfully called the API (ISO 8601, or null).',
    example: '2026-05-09T08:12:00.000Z',
    nullable: true,
  })
  lastUsedAt!: string | null;
}
