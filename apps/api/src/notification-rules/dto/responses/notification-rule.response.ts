import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DIGEST_MODES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  type DigestMode,
  type NotificationChannel,
  type NotificationTrigger,
} from '@klar/shared';

export class NotificationRuleResponse {
  @ApiProperty({ example: 'nrl_3a8d-2c1a-...' })
  id!: string;

  @ApiProperty({ example: 'hh_3f8e-2c1a-...' })
  householdId!: string;

  @ApiProperty({ example: 'usr_9c2f-...' })
  userId!: string;

  @ApiProperty({ example: 'Großer Eingang' })
  name!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ enum: NOTIFICATION_TRIGGERS, example: 'TRANSACTION_CREATED' })
  trigger!: NotificationTrigger;

  @ApiProperty({ description: 'Predicate AST.', type: Object })
  predicate!: unknown;

  @ApiPropertyOptional({ description: 'Schedule (SCHEDULED trigger).', type: Object })
  schedule?: unknown;

  @ApiPropertyOptional({ example: 1 })
  leadTimeDays?: number | null;

  @ApiProperty({ isArray: true, enum: NOTIFICATION_CHANNELS, example: ['IN_APP'] })
  channels!: NotificationChannel[];

  @ApiProperty({ enum: DIGEST_MODES, example: 'IMMEDIATE' })
  digestMode!: DigestMode;

  @ApiPropertyOptional({ example: 10 })
  cooldownMinutes?: number | null;

  @ApiPropertyOptional({ example: 12 })
  maxPerHour?: number | null;

  @ApiPropertyOptional({ example: 50 })
  maxPerDay?: number | null;

  @ApiPropertyOptional({ example: '2026-05-08T12:34:56.000Z' })
  lastFiredAt?: string | null;

  @ApiProperty({ example: '2026-05-08T11:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-08T11:00:00.000Z' })
  updatedAt!: string;
}

export class NotificationRulePreviewResponse {
  @ApiProperty({
    description: 'How many existing transactions in the look-back window matched.',
    example: 12,
  })
  wouldHaveFiredCount!: number;

  @ApiProperty({
    description: 'Up to 5 matching items for the rule list preview.',
    example: [{ at: '2026-04-30', title: 'Arbeitgeber GmbH', amountCents: 250000 }],
  })
  sample!: Array<{ at: string; title: string; amountCents: number }>;
}

export class NotificationRuleTestResponse {
  @ApiProperty({ example: true })
  dispatched!: boolean;

  @ApiProperty({
    isArray: true,
    enum: NOTIFICATION_CHANNELS,
    description: 'Channels the test notification was attempted on.',
    example: ['IN_APP'],
  })
  channels!: NotificationChannel[];
}

export class RuleActivityItemResponse {
  @ApiProperty({ example: 'nrlf_2a8d-...' })
  id!: string;

  @ApiProperty({ example: 'nrl_3a8d-...' })
  ruleId!: string;

  @ApiProperty({ example: 'transaction' })
  sourceKind!: string;

  @ApiProperty({ example: 'tx_5e1c-...' })
  sourceId!: string;

  @ApiProperty({ example: '2026-05-08T12:34:56.000Z' })
  firedAt!: string;

  @ApiProperty({ isArray: true, enum: NOTIFICATION_CHANNELS, example: ['IN_APP'] })
  channelsSent!: NotificationChannel[];

  @ApiPropertyOptional({ example: 'ntf_9c2f-...' })
  notificationId?: string | null;
}

export class RuleActivityListResponse {
  @ApiProperty({ isArray: true, type: () => RuleActivityItemResponse })
  items!: RuleActivityItemResponse[];
}
