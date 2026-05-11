import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus, Visibility } from '@prisma/client';

export class ProjectResponse {
  @ApiProperty({ description: 'Project ID (UUID).', example: 'prj_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Household this project belongs to.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ description: 'User who created the project.', example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a' })
  createdByUserId!: string;

  @ApiProperty({ description: 'Display name.', example: 'Hochzeit 2026' })
  name!: string;

  @ApiProperty({ description: 'Free-text description.', example: 'Budget für Location, Catering, Foto und Reise.', nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'Lifecycle status.', enum: ProjectStatus, example: ProjectStatus.ACTIVE })
  status!: ProjectStatus;

  @ApiProperty({
    description: 'Total project budget in cents.',
    example: 1500000,
    nullable: true,
  })
  totalBudgetCents!: number | null;

  @ApiProperty({ description: 'Project start date (`YYYY-MM-DD`).', example: '2026-01-01', nullable: true })
  startDate!: string | null;

  @ApiProperty({ description: 'Project end date (`YYYY-MM-DD`).', example: '2026-09-30', nullable: true })
  endDate!: string | null;

  @ApiProperty({ description: 'Hex accent color.', example: '#a78bfa' })
  color!: string;

  @ApiProperty({ description: 'Visibility scope.', enum: Visibility, example: Visibility.SHARED })
  visibility!: Visibility;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-01T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}
