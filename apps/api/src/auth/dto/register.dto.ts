import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  inviteToken?: string;
}
