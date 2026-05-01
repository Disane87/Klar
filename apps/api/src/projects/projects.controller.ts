import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProjectStatus } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ProjectsService } from './projects.service';
import type { CreateProjectInput, UpdateProjectInput } from './projects.service';

@Controller('households/:hid/projects')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('status') status?: string,
  ) {
    const validStatus = status ? (ProjectStatus[status as keyof typeof ProjectStatus] ?? null) : undefined;
    if (status && !validStatus) throw new BadRequestException(`Ungültiger Status: ${status}`);

    const items = await this.service.list(ctx, { status: validStatus ?? undefined });
    return items.map(p => this.service.toResponse(p));
  }

  @Post()
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateProjectInput,
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (!body.color) throw new BadRequestException('Farbe ist erforderlich');

    const item = await this.service.create(ctx, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateProjectInput,
  ) {
    const item = await this.service.update(ctx, id, body);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
