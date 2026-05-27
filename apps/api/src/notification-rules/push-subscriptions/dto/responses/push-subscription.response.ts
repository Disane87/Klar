import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PushSubscriptionResponse {
  @ApiProperty({ example: 'sub_3a8d-...' })
  id!: string;

  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/abc…' })
  endpoint!: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0 …' })
  userAgent?: string | null;

  @ApiProperty({ example: '2026-05-08T11:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-08T11:00:00.000Z' })
  lastSeenAt!: string;
}

export class VapidPublicKeyResponse {
  @ApiProperty({
    description:
      'VAPID public key (base64url) the frontend hands to PushManager.subscribe(). Returns an empty string when the server has no VAPID keys configured.',
    example: 'BNc...wQ',
  })
  publicKey!: string;
}
