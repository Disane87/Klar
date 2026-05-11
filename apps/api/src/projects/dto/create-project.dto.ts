import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus, Visibility } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ description: 'Display name (1..100 chars).', example: 'Hochzeit 2026' })
  name!: string;

  @ApiProperty({ description: 'Hex accent color.', example: '#a78bfa' })
  color!: string;

  @ApiProperty({
    description: 'Free-text description.',
    example: 'Budget für Location, Catering, Foto und Reise.',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description: 'Lifecycle status.',
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
    required: false,
  })
  status?: ProjectStatus;

  @ApiProperty({
    description: 'Total project budget in cents (positive integer). `null` for open-budget projects.',
    example: 1500000,
    required: false,
    nullable: true,
  })
  totalBudgetCents?: number | null;

  @ApiProperty({
    description: 'Project start date (`YYYY-MM-DD`).',
    example: '2026-01-01',
    required: false,
    nullable: true,
  })
  startDate?: string | null;

  @ApiProperty({
    description: 'Project end date (`YYYY-MM-DD`).',
    example: '2026-09-30',
    required: false,
    nullable: true,
  })
  endDate?: string | null;

  @ApiProperty({
    description:
      'Visibility scope. PRIVATE projects are only visible/editable by their creator and never roll up into household aggregates.',
    enum: Visibility,
    example: Visibility.SHARED,
    required: false,
  })
  visibility?: Visibility;
}

export class UpdateProjectDto extends CreateProjectDto {}
