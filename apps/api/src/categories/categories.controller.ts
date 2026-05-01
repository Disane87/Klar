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
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { CategoriesService } from './categories.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.service';

@Controller('households/:hid/categories')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
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
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateCategoryInput,
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (!body.type || !Object.values(CategoryType).includes(body.type)) {
      throw new BadRequestException('Ungültiger Typ');
    }
    if (!body.color) throw new BadRequestException('Farbe ist erforderlich');

    const item = await this.service.create(ctx, body);
    return this.service.toResponse(item);
  }

  @Patch(':id')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateCategoryInput,
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
