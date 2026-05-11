import { ApiProperty } from '@nestjs/swagger';

const TEMPLATE_TYPES = [
  'INVITE',
  'REMINDER',
  'CUSTOM',
  'EMAIL_VERIFY',
  'PASSWORD_RESET',
  'TOTP_ENABLE',
  'TOTP_DISABLE',
  'API_KEY_CREATED',
] as const;

export class MailTemplateResponse {
  @ApiProperty({ example: 'mtp_01HX...' })
  id!: string;

  @ApiProperty({ example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ enum: TEMPLATE_TYPES, example: 'INVITE' })
  templateType!: (typeof TEMPLATE_TYPES)[number];

  @ApiProperty({ example: 'Custom invite email' })
  name!: string;

  @ApiProperty({ example: 'Welcome to {{householdName}}' })
  subject!: string;

  @ApiProperty({ example: '<p>Hi {{recipientName}}, ...</p>' })
  body!: string;

  @ApiProperty({ example: '2026-04-01T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}

export class MailTemplateDeleteResponse {
  @ApiProperty({ example: true })
  success!: boolean;
}
