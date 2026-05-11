import { ApiProperty } from '@nestjs/swagger';
import { APP_VERSION } from '../../../common/app-version';

export class HealthResponse {
  @ApiProperty({
    description: 'Liveness status. Always `ok` when the process is responding.',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status!: 'ok' | 'error';

  @ApiProperty({
    description: 'ISO 8601 timestamp when the probe was answered.',
    example: '2026-05-10T08:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description:
      'Application version, sourced from `APP_VERSION` (set during Docker build). Falls back to `dev` in local development.',
    example: '1.18.0',
  })
  version!: string;
}
