import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RenameGrantDto {
  @ApiProperty({
    description:
      'New user-defined display name for the OAuth client. Pass null or an empty string to reset to the original registration name.',
    example: 'My Claude Desktop',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;
}

export class ConsentInfoResponse {
  @ApiProperty({ description: 'Client display name.', example: 'Claude Desktop' })
  clientName!: string;

  @ApiProperty({ description: 'Optional logo URL.', example: 'https://claude.ai/icon.png', nullable: true, required: false })
  logoUri?: string | null;

  @ApiProperty({
    description: 'Scopes the client is asking the user to approve.',
    example: ['transactions:read', 'budgets:read'],
    type: [String],
  })
  scopes!: string[];

  @ApiProperty({ description: 'Validated redirect URI.', example: 'http://localhost:8080/callback' })
  redirectUri!: string;

  @ApiProperty({ description: 'Whether this exact (client + scopes) was already approved before.', example: false })
  preApproved!: boolean;
}

export class IssuedAuthCodeResponse {
  @ApiProperty({
    description: 'Final URL to redirect the browser to (with ?code=...&state=... or ?error=access_denied).',
    example: 'http://localhost:8080/callback?code=ac_7f9a2b3c8d1e&state=state-7f9a',
  })
  redirectUrl!: string;
}
