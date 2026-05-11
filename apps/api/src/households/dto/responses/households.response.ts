import { ApiProperty } from '@nestjs/swagger';

export class HouseholdSummaryResponse {
  @ApiProperty({ example: 'hh_3f8e-...' })
  id!: string;

  @ApiProperty({ example: 'Familie Franke' })
  name!: string;

  @ApiProperty({ enum: ['OWNER', 'MEMBER'], example: 'OWNER' })
  role!: string;

  @ApiProperty({ description: 'Optional household note (markdown).', example: 'Gemeinsame Haushaltskasse', nullable: true })
  note!: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt!: string;
}

export class HouseholdMemberResponse {
  @ApiProperty({ example: 'usr_3f8e-...' })
  userId!: string;

  @ApiProperty({ example: 'marco@example.com' })
  email!: string;

  @ApiProperty({ example: 'Marco' })
  displayName!: string;

  @ApiProperty({ example: '/api/v1/users/usr_3f8e/avatar/abc.png', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ enum: ['OWNER', 'MEMBER'], example: 'OWNER' })
  role!: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  joinedAt!: string;
}

export class HouseholdInviteLinkResponse {
  @ApiProperty({ example: 'inv_3f8e-...' })
  id!: string;

  @ApiProperty({ description: 'Opaque invite token. Combine with the public /join/:token route.', example: 'tok_3f8e-...' })
  token!: string;

  @ApiProperty({ description: 'Full join URL the user should open in a browser.', example: 'https://your-klar-instance.com/join/tok_3f8e-...' })
  url!: string;

  @ApiProperty({ description: 'When the invite expires (ISO 8601). Null = never.', example: '2026-06-08T07:00:00.000Z', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ description: 'When the invite was used (ISO 8601). Null = unused.', example: null, nullable: true })
  usedAt!: string | null;

  @ApiProperty({ example: '2026-05-09T07:00:00.000Z' })
  createdAt!: string;
}

export class HouseholdInviteInfoResponse {
  @ApiProperty({ example: 'Familie Franke' })
  householdName!: string;

  @ApiProperty({ description: 'Display name of the user who created the invite.', example: 'Marco' })
  inviterName!: string;

  @ApiProperty({ example: '2026-06-08T07:00:00.000Z', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ description: 'True when token has been used or expired.', example: false })
  isInvalid!: boolean;
}

export class JoinHouseholdResponse {
  @ApiProperty({ example: 'hh_3f8e-...' })
  householdId!: string;

  @ApiProperty({ example: 'Familie Franke' })
  householdName!: string;

  @ApiProperty({ enum: ['OWNER', 'MEMBER'], example: 'MEMBER' })
  role!: string;
}
