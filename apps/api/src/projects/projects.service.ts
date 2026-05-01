import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Project } from '@prisma/client';
import { ProjectStatus, Visibility } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { ProjectsRepository, type UpdateProjectData } from './projects.repository';

export { ProjectStatus, Visibility };

export interface CreateProjectInput {
  name: string;
  color: string;
  description?: string | null;
  status?: ProjectStatus;
  totalBudgetCents?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  visibility?: Visibility;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

function parsePlainDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  list(ctx: RequestContext, opts: { status?: ProjectStatus } = {}): Promise<Project[]> {
    return this.repo.findAll(ctx.householdId, { ...opts, userId: ctx.userId });
  }

  async create(ctx: RequestContext, input: CreateProjectInput): Promise<Project> {
    return this.repo.create({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: input.name.trim(),
      color: input.color,
      description: input.description ?? null,
      status: input.status ?? ProjectStatus.ACTIVE,
      totalBudgetCents: input.totalBudgetCents ?? null,
      startDate: parsePlainDate(input.startDate),
      endDate: parsePlainDate(input.endDate),
      visibility: input.visibility ?? Visibility.SHARED,
    });
  }

  async update(ctx: RequestContext, id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await this.findAndAuthorize(ctx, id);

    const data: UpdateProjectData = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.color !== undefined) data.color = input.color;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.totalBudgetCents !== undefined) data.totalBudgetCents = input.totalBudgetCents;
    if (input.startDate !== undefined) data.startDate = parsePlainDate(input.startDate);
    if (input.endDate !== undefined) data.endDate = parsePlainDate(input.endDate);
    if (input.visibility !== undefined) data.visibility = input.visibility;

    return this.repo.update(existing.id, data);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.findAndAuthorize(ctx, id);

    const hasTransactions = await this.repo.hasTransactions(existing.id);
    if (hasTransactions) {
      // Archive instead of hard delete to preserve transaction links
      await this.repo.update(existing.id, { status: ProjectStatus.ARCHIVED });
    } else {
      await this.repo.delete(existing.id);
    }
  }

  toResponse(p: Project) {
    return {
      id: p.id,
      householdId: p.householdId,
      createdByUserId: p.createdByUserId,
      name: p.name,
      description: p.description,
      status: p.status,
      totalBudgetCents: p.totalBudgetCents,
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
      color: p.color,
      visibility: p.visibility,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private async findAndAuthorize(ctx: RequestContext, id: string): Promise<Project> {
    const project = await this.repo.findById(id, ctx.householdId);
    if (!project) throw new NotFoundException(`Projekt ${id} nicht gefunden`);

    // Only creator can modify PRIVATE projects
    if (project.visibility === Visibility.PRIVATE && project.createdByUserId !== ctx.userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Projekt');
    }

    return project;
  }
}
