import { Injectable } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { ProjectStatus, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProjectData {
  householdId: string;
  createdByUserId: string;
  name: string;
  color: string;
  description?: string | null;
  status?: ProjectStatus;
  totalBudgetCents?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  visibility?: Visibility;
}

export interface UpdateProjectData {
  name?: string;
  color?: string;
  description?: string | null;
  status?: ProjectStatus;
  totalBudgetCents?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  visibility?: Visibility;
}

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    householdId: string,
    opts: { status?: ProjectStatus; userId?: string } = {},
  ): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: {
        householdId,
        ...(opts.status ? { status: opts.status } : {}),
        // Visibility filter: return SHARED projects + PRIVATE projects owned by userId
        ...(opts.userId
          ? {
              OR: [
                { visibility: Visibility.SHARED },
                { visibility: Visibility.PRIVATE, createdByUserId: opts.userId },
              ],
            }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  findById(id: string, householdId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, householdId } });
  }

  create(data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  update(id: string, data: UpdateProjectData): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  async hasTransactions(id: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({ where: { projectId: id } });
    const rCount = await this.prisma.recurringTransaction.count({ where: { projectId: id } });
    return count + rCount > 0;
  }

  delete(id: string): Promise<Project> {
    return this.prisma.project.delete({ where: { id } });
  }
}
