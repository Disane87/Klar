import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DIGEST_MODES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  type DigestMode,
  type NotificationChannel,
  type NotificationTrigger,
  type Predicate,
  type Schedule,
} from '@klar/shared';

/**
 * Rule create DTO. The predicate is validated lazily by the service against
 * the shared zod schema + the per-trigger field whitelist — class-validator
 * only checks shape here.
 */
export class CreateNotificationRuleDto {
  @ApiProperty({ description: 'User-facing rule label.', example: 'Großer Eingang' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Rule disabled at creation. Default true.', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Trigger source. Determines which fields are valid in the predicate.',
    enum: NOTIFICATION_TRIGGERS,
    example: 'TRANSACTION_CREATED',
  })
  @IsEnum(NOTIFICATION_TRIGGERS)
  trigger!: NotificationTrigger;

  @ApiProperty({
    description:
      'Predicate AST (see packages/shared/notification-rules/predicate-types). Validated per-trigger.',
    example: {
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 },
        { op: 'cmp', field: 'isIncome', operator: '=', value: true },
      ],
    },
  })
  @IsObject()
  predicate!: Predicate;

  @ApiPropertyOptional({
    description: 'Schedule descriptor when trigger=SCHEDULED. Ignored otherwise.',
    example: { type: 'daily', time: '08:00' },
  })
  @IsOptional()
  @IsObject()
  schedule?: Schedule;

  @ApiPropertyOptional({
    description: 'Lead time in days for STANDING_ORDER_DUE (default 1).',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @ApiProperty({
    description: 'Channels to fan-out matches to. At least one required.',
    isArray: true,
    enum: NOTIFICATION_CHANNELS,
    example: ['IN_APP'],
  })
  @IsArray()
  @IsEnum(NOTIFICATION_CHANNELS, { each: true })
  channels!: NotificationChannel[];

  @ApiPropertyOptional({
    description:
      'Batching mode. IMMEDIATE fires per match; HOURLY/DAILY queue matches and flush via crons.',
    enum: DIGEST_MODES,
    example: 'IMMEDIATE',
  })
  @IsOptional()
  @IsEnum(DIGEST_MODES)
  digestMode?: DigestMode;

  @ApiPropertyOptional({
    description: 'Cooldown between successive matches for the same rule (minutes).',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownMinutes?: number;

  @ApiPropertyOptional({ description: 'Hourly cap per rule.', example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerHour?: number;

  @ApiPropertyOptional({ description: 'Daily cap per rule.', example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerDay?: number;
}
