import { ApiProperty } from '@nestjs/swagger';

export class NotificationItemResponse {
  @ApiProperty({ example: 'ntf_2a8d-...' })
  id!: string;

  @ApiProperty({
    description: 'Notification kind. Drives icon + UI rendering.',
    example: 'FINTS_SYNC_FAILED',
  })
  type!: string;

  @ApiProperty({ description: 'Headline text.', example: 'FinTS-Sync fehlgeschlagen' })
  title!: string;

  @ApiProperty({ description: 'Body text.', example: 'Sparkasse KölnBonn: TAN_TIMEOUT.' })
  body!: string;

  @ApiProperty({ description: 'Optional deep link target inside the app.', example: '/app/fints', nullable: true })
  link!: string | null;

  @ApiProperty({ description: 'When the notification was read by the recipient (ISO 8601). Null = unread.', example: null, nullable: true })
  readAt!: string | null;

  @ApiProperty({ description: 'When the notification was created (ISO 8601).', example: '2026-05-09T07:00:05.000Z' })
  createdAt!: string;
}

export class NotificationListResponse {
  @ApiProperty({ type: () => [NotificationItemResponse] })
  items!: NotificationItemResponse[];

  @ApiProperty({
    description: 'Cursor for the next page. Null when no more items.',
    example: '2026-05-08T12:00:00.000Z|ntf_98a2-...',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Number of unread notifications across all pages.', example: 3 })
  unreadCount!: number;
}

export class MarkAllReadResponse {
  @ApiProperty({ description: 'Number of notifications transitioned to read.', example: 12 })
  marked!: number;
}
