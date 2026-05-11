import { ApiProperty } from '@nestjs/swagger';

export class FintsBankLookupResponse {
  @ApiProperty({ description: 'BLZ (Bankleitzahl, 8 digits).', example: '37050198' })
  blz!: string;

  @ApiProperty({ description: 'Bank display name.', example: 'Sparkasse KölnBonn' })
  bankName!: string;

  @ApiProperty({ description: 'FinTS / HBCI server URL.', example: 'https://hbci.example-bank.de/fints' })
  serverUrl!: string;

  @ApiProperty({ description: 'BIC.', example: 'COLSDE33XXX', nullable: true })
  bic!: string | null;
}

export class FintsAccountSubResponse {
  @ApiProperty({ example: 'acc_2a8d-...' })
  id!: string;

  @ApiProperty({ example: 'Girokonto Hauptkonto' })
  name!: string;

  @ApiProperty({ enum: ['CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD'], example: 'CHECKING' })
  type!: string;

  @ApiProperty({ example: 'DE89370400440532013000', nullable: true })
  iban!: string | null;

  @ApiProperty({ example: 'COLSDE33XXX', nullable: true })
  bic!: string | null;

  @ApiProperty({ description: 'lib-fints account reference.', example: '0532013000', nullable: true })
  fintsAccountRef!: string | null;

  @ApiProperty({ description: 'Last known balance in cents (signed).', example: 142350, nullable: true })
  lastKnownBalanceCents!: number | null;

  @ApiProperty({ description: 'When the last balance was observed (ISO 8601).', example: '2026-05-09T08:12:00.000Z', nullable: true })
  lastBalanceAt!: string | null;

  @ApiProperty({ example: true })
  syncEnabled!: boolean;
}

export class FintsConnectionResponse {
  @ApiProperty({ example: 'fc_8a2d-...' })
  id!: string;

  @ApiProperty({ description: 'User who created the connection (only owner can write).', example: 'usr_3f8e-...' })
  ownerId!: string;

  @ApiProperty({ example: 'hh_3f8e-...' })
  householdId!: string;

  @ApiProperty({ example: 'Sparkasse KölnBonn' })
  bankName!: string;

  @ApiProperty({ example: '37050198' })
  blz!: string;

  @ApiProperty({ description: 'Online-banking login (anonymized for non-owners).', example: 'a******5' })
  loginName!: string;

  @ApiProperty({ enum: ['ACTIVE', 'NEEDS_TAN', 'DISABLED', 'ERROR'], example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ description: 'Last successful Strong Customer Authentication (ISO 8601).', example: '2026-05-08T07:00:00.000Z', nullable: true })
  lastScaAt!: string | null;

  @ApiProperty({ description: 'When the SCA window expires and a new TAN will be required.', example: '2026-08-08T07:00:00.000Z', nullable: true })
  scaExpiresAt!: string | null;

  @ApiProperty({ example: '2026-05-09T07:00:00.000Z', nullable: true })
  lastSyncAt!: string | null;

  @ApiProperty({ enum: ['OK', 'FAILED', 'PARTIAL'], example: 'OK', nullable: true })
  lastSyncStatus!: string | null;

  @ApiProperty({ example: '2026-04-15T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-09T07:00:05.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: () => [FintsAccountSubResponse] })
  accounts!: FintsAccountSubResponse[];
}

export class FintsTanChallengeResponse {
  @ApiProperty({ enum: ['decoupled', 'pushTan', 'chipTan', 'mobileTan'], example: 'pushTan' })
  type!: string;

  @ApiProperty({ description: 'Human-readable instruction shown to the user.', example: 'Bitte bestätigen Sie die Anmeldung in Ihrer Banking-App.' })
  message!: string;

  @ApiProperty({ description: 'Whether the user must enter a TAN code (false for decoupled flows).', example: false })
  requiresInput!: boolean;
}

export class FintsSyncRunResponse {
  @ApiProperty({ example: 'sr_8a2d-...' })
  id!: string;

  @ApiProperty({ example: 'fc_8a2d-...' })
  connectionId!: string;

  @ApiProperty({ enum: ['PENDING', 'RUNNING', 'AWAITING_TAN', 'OK', 'FAILED'], example: 'OK' })
  status!: string;

  @ApiProperty({ enum: ['MANUAL', 'SCHEDULE', 'SETUP'], example: 'MANUAL' })
  triggeredBy!: string;

  @ApiProperty({ example: '2026-05-09T07:00:00.000Z' })
  startedAt!: string;

  @ApiProperty({ example: '2026-05-09T07:00:05.000Z', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ description: 'Bookings retrieved from the bank.', example: 142 })
  bookingsFetched!: number;

  @ApiProperty({ description: 'Bookings persisted as new transactions.', example: 12 })
  bookingsImported!: number;

  @ApiProperty({ description: 'Bookings skipped (duplicate or fixed-cost match).', example: 130 })
  bookingsSkipped!: number;

  @ApiProperty({ example: 'TAN_TIMEOUT', nullable: true })
  errorCode!: string | null;

  @ApiProperty({ example: 'Die TAN-Eingabe wurde nicht rechtzeitig bestätigt.', nullable: true })
  errorMessage!: string | null;
}

export class FintsCreateConnectionResponse {
  @ApiProperty({ type: () => FintsConnectionResponse })
  connection!: FintsConnectionResponse;

  @ApiProperty({ type: () => FintsSyncRunResponse })
  syncRun!: FintsSyncRunResponse;

  @ApiProperty({ type: () => FintsTanChallengeResponse, nullable: true, required: false })
  tanChallenge!: FintsTanChallengeResponse | null;
}

export class FintsTriggerSyncResponse {
  @ApiProperty({ type: () => FintsSyncRunResponse })
  syncRun!: FintsSyncRunResponse;

  @ApiProperty({ type: () => FintsTanChallengeResponse, nullable: true, required: false })
  tanChallenge!: FintsTanChallengeResponse | null;
}

export class FintsDiscoveredAccountResponse {
  @ApiProperty({ description: 'lib-fints account reference (use to attach in /accounts).', example: '0532013000' })
  fintsAccountRef!: string;

  @ApiProperty({ example: 'DE89370400440532013000', nullable: true })
  iban!: string | null;

  @ApiProperty({ example: 'COLSDE33XXX', nullable: true })
  bic!: string | null;

  @ApiProperty({ example: 'Girokonto', nullable: true })
  productName!: string | null;

  @ApiProperty({ example: 'CHECKING', nullable: true })
  type!: string | null;

  @ApiProperty({ description: 'Whether this sub-account is already linked to a Klar Account.', example: false })
  alreadyAttached!: boolean;
}

export class FintsCapabilitiesResponse {
  @ApiProperty({
    description:
      'Maximum days the bank will accept as `from`-date on a statement request. Derived from the HKKAZ/HKCAZ `maxDays` parameter in the BPD. `null` when the bank advertises no upper bound.',
    example: 365,
    nullable: true,
  })
  maxLookbackDays!: number | null;

  @ApiProperty({ description: 'Bank supports CAMT statement retrieval (HKCAZ).', example: true })
  supportsHKCAZ!: boolean;

  @ApiProperty({ description: 'Bank supports MT940 statement retrieval (HKKAZ).', example: true })
  supportsHKKAZ!: boolean;

  @ApiProperty({
    description: 'Bank flagged the statement segment as TAN-pflichtig — the wizard warns before a long range is picked.',
    example: false,
  })
  tanRequiredForStatements!: boolean;

  @ApiProperty({
    description: 'When the snapshot was taken (refreshed after every successful sync).',
    example: '2026-05-11T08:35:00.000Z',
  })
  extractedAt!: string;
}

export class FintsDeleteImpactResponse {
  @ApiProperty({ description: 'Klar accounts that will be detached or archived.', example: 2 })
  accounts!: number;

  @ApiProperty({ description: 'Transactions that remain (kept) after disconnect.', example: 1843 })
  transactions!: number;

  @ApiProperty({ description: 'Recurring/standing-orders that remain (kept) after disconnect.', example: 12 })
  standingOrders!: number;
}
