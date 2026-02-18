import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinHouseholdDto {
  @ApiProperty({ example: 'abc123' })
  @IsString()
  inviteCode: string;
}
