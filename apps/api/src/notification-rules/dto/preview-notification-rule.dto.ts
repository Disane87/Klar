import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { NOTIFICATION_TRIGGERS, type NotificationTrigger, type Predicate } from '@klar/shared';

export class PreviewNotificationRuleDto {
  @ApiProperty({
    description: 'Trigger to evaluate against.',
    enum: NOTIFICATION_TRIGGERS,
    example: 'TRANSACTION_CREATED',
  })
  @IsEnum(NOTIFICATION_TRIGGERS)
  trigger!: NotificationTrigger;

  @ApiProperty({ description: 'Predicate AST to dry-run.' })
  @IsObject()
  predicate!: Predicate;

  @ApiPropertyOptional({
    description: 'Look-back window in days. Defaults to 90, max 365.',
    example: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
