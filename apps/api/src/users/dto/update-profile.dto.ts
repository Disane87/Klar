import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'New display name shown in the UI.',
    example: 'Alex Example',
    required: false,
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({
    description: 'New email address. Triggers a verification email and keeps the old address active until confirmed.',
    example: 'alex.new@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current account password.',
    example: 'correct horse battery staple',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({
    description: 'New account password (Argon2id-hashed server-side).',
    example: 'new strong passphrase 2026',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class UploadAvatarDto {
  @ApiProperty({
    description: 'Base64-encoded image data URL (PNG/JPEG/WEBP). Max 2 MB after decoding.',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/3eSj1QAAAABJRU5ErkJggg==',
  })
  @IsString()
  @MinLength(20)
  data!: string;
}

export class AvatarResponse {
  @ApiProperty({
    description: 'Public URL of the uploaded avatar.',
    example: '/api/v1/users/me/avatar/abc123.png',
  })
  avatarUrl!: string;
}
