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

export class CreateMailTemplateBodyDto {
  @ApiProperty({
    enum: TEMPLATE_TYPES,
    description: 'Which built-in template slot to override.',
    example: 'INVITE',
  })
  templateType!: (typeof TEMPLATE_TYPES)[number];

  @ApiProperty({ description: 'Display name shown in the admin UI.', example: 'Custom invite email' })
  name!: string;

  @ApiProperty({ description: 'Email subject line. Supports `{{handlebars}}` placeholders.', example: 'Welcome to {{householdName}}' })
  subject!: string;

  @ApiProperty({
    description: 'Email body (HTML or Markdown). Supports `{{handlebars}}` placeholders.',
    example: '<p>Hi {{recipientName}}, you have been invited to {{householdName}}.</p>',
  })
  body!: string;
}

export class UpdateMailTemplateBodyDto {
  @ApiProperty({ required: false, example: 'Custom invite email' })
  name?: string;

  @ApiProperty({ required: false, example: 'Welcome to {{householdName}}' })
  subject?: string;

  @ApiProperty({ required: false, example: '<p>Hi {{recipientName}}, ...</p>' })
  body?: string;
}
