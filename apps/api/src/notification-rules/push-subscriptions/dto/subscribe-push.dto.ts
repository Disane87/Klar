import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty({
    description: 'Client P-256 ECDH public key, base64url-encoded.',
    example: 'BNc...wQ',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  p256dh!: string;

  @ApiProperty({
    description: 'Authentication secret, base64url-encoded.',
    example: 'k1m...8A',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  auth!: string;
}

export class SubscribePushDto {
  @ApiProperty({
    description:
      'Push service endpoint URL emitted by the browser PushManager. Unique per device + browser session.',
    example: 'https://fcm.googleapis.com/fcm/send/abc123…',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2000)
  endpoint!: string;

  @ApiProperty({ description: 'ECDH + auth keys returned by sub.toJSON().keys.' })
  @IsObject()
  keys!: PushSubscriptionKeysDto;

  @ApiPropertyOptional({
    description: 'User-Agent string, for the "Manage devices" UI.',
    example: 'Mozilla/5.0 …',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}
