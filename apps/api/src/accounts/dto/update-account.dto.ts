import { ApiProperty } from '@nestjs/swagger';

/**
 * PATCH body for `/households/:hid/accounts/:id`. All fields optional —
 * only provided keys are updated. FinTS-owned accounts may only be updated
 * by their owner (enforced server-side).
 */
export class UpdateAccountDto {
  @ApiProperty({
    description: 'Display name (1..100 chars).',
    example: 'Girokonto Sparkasse',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Visibility scope inside the household.',
    enum: ['SHARED', 'PRIVATE'],
    example: 'SHARED',
    required: false,
  })
  visibility?: 'SHARED' | 'PRIVATE';

  @ApiProperty({
    description:
      'ISO 8601 timestamp when the account was archived, or `null` to un-archive.',
    example: '2026-05-08T10:15:00.000Z',
    required: false,
    nullable: true,
  })
  archivedAt?: string | null;

  @ApiProperty({
    description:
      'Whether automatic FinTS sync is enabled for this account. Ignored for non-FinTS accounts.',
    example: true,
    required: false,
  })
  syncEnabled?: boolean;
}
