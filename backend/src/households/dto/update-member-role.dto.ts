import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { HouseholdRole } from '../household-member.entity';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: HouseholdRole, example: HouseholdRole.MEMBER })
  @IsEnum(HouseholdRole)
  role: HouseholdRole;
}
