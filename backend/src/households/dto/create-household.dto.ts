import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHouseholdDto {
  @ApiProperty({ example: 'Smith Family' })
  @IsString()
  name: string;
}
