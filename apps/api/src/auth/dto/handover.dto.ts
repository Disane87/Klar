import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class HandoverDto {
  @ApiProperty({
    description:
      'One-time OTP code returned by the OIDC callback redirect; exchanged for a real token pair.',
    example: '7f9a2b3c8d1e4f5a6b7c8d9e0f1a2b3c',
  })
  @IsString()
  @MinLength(8)
  code!: string;
}
