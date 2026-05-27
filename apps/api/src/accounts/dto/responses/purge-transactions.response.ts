import { ApiProperty } from '@nestjs/swagger';

export class PurgeTransactionsResponse {
  @ApiProperty({
    description: 'Number of transaction rows removed from the account.',
    example: 142,
  })
  deletedTransactions!: number;

  @ApiProperty({
    description:
      'Number of FinTS-derived standing-order detections removed. Manual standing orders are kept.',
    example: 3,
  })
  deletedStandingOrders!: number;
}
