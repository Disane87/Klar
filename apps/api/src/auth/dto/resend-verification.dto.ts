import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({
    description: 'Email address to resend the verification mail to.',
    example: 'alex@example.com',
  })
  @IsEmail()
  email!: string;
}
