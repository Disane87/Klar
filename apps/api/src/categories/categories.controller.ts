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
import { CategoryType } from '@prisma/client';
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
import { HouseholdOwnerGuard } from '../common/guards/household-owner.guard';
import { CategoriesService } from './categories.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CategoryResponse } from './dto/responses/category.response';

@ApiTags('Categories')
@Controller('households/:hid/categories')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description:
    'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List categories',
    description:
      'Returns categories for the caller’s household. Filter by `type` and/or include archived rows. Every household is auto-seeded with a default set on creation.',
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by category type.', example: 'VARIABLE_EXPENSE' })
  @ApiQuery({ name: 'includeArchived', required: false, description: 'Pass `true` to include archived rows.', example: 'false' })
  @ApiResponse({ status: 200, type: CategoryResponse, isArray: true })
  @ApiResponse({ status: 400, description: 'Invalid `type` value.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household member.' })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query('type') type?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const validType = type ? (CategoryType[type as keyof typeof CategoryType] ?? null) : undefined;
    if (type && !validType) throw new BadRequestException(`Ungültiger Typ: ${type}`);

    const items = await this.service.list(ctx, {
      type: validType ?? undefined,
      includeArchived: includeArchived === 'true',
    });
    return items.map(c => this.service.toResponse(c));
  }

  @Post()
  @UseGuards(HouseholdOwnerGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a category',
    description:
      'Creates a new category in the caller’s household. Only household owners may create categories.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, type: CategoryResponse })
  @ApiResponse({ status: 400, description: 'Missing required fields (name / type / color).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household owner.' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateCategoryDto,
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (!body.type || !Object.values(CategoryType).includes(body.type)) {
      throw new BadRequestException('Ungültiger Typ');
    }
    if (!body.color) throw new BadRequestException('Farbe ist erforderlich');

    const item = await this.service.create(ctx, body as CreateCategoryInput);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  @UseGuards(HouseholdOwnerGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Update a category',
    description:
      'Patches a category. Only household owners may modify categories. Re-naming default categories is allowed and persists until reset.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, type: CategoryResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household owner.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const item = await this.service.update(ctx, id, body as UpdateCategoryInput);
    return this.service.toResponse(item);
  }

  @Delete(':id')
  @UseGuards(HouseholdOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Delete a category',
    description:
      'Categories with attached transactions are soft-archived (`isArchived=true`) to preserve referential integrity. Empty categories are hard-deleted. Only household owners may delete.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiResponse({ status: 204, description: 'Deleted or archived.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a household owner.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(ctx, id);
  }
}
