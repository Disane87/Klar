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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ProjectsService } from './projects.service';
import type { CreateProjectInput, UpdateProjectInput } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { ProjectResponse } from './dto/responses/project.response';

@ApiTags('Projects')
@Controller('households/:hid/projects')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List projects',
    description:
      'Returns projects visible to the caller in the current household. PRIVATE projects of other users are filtered out.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by project status.', example: 'ACTIVE' })
  @ApiResponse({ status: 200, type: ProjectResponse, isArray: true })
  @ApiResponse({ status: 400, description: 'Invalid `status` value.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
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
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a project',
    description:
      'Creates a new project in the caller’s household. PRIVATE projects are only visible/editable by their creator.',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, type: ProjectResponse })
  @ApiResponse({ status: 400, description: 'Missing required fields (name / color).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateProjectDto,
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (!body.color) throw new BadRequestException('Farbe ist erforderlich');

    const item = await this.service.create(ctx, body as CreateProjectInput);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a project',
    description:
      'Patches a project by ID. PRIVATE projects can only be modified by their creator.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID.', example: 'prj_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, type: ProjectResponse })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not allowed to modify this project.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
  ) {
    const item = await this.service.update(ctx, id, body as UpdateProjectInput);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a project',
    description:
      'Projects with attached transactions are soft-archived (`status=ARCHIVED`) to preserve transaction links. Empty projects are hard-deleted.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID.', example: 'prj_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Deleted or archived.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not allowed to delete this project.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
