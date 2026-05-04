import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MailTemplateService } from './mail-template.service';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import type { MailTemplateType } from '@prisma/client';
import { CreateMailTemplateDto, UpdateMailTemplateDto } from './mail-template.service';

const VALID_TEMPLATE_TYPES = [
  'INVITE',
  'REMINDER',
  'CUSTOM',
  'EMAIL_VERIFY',
  'PASSWORD_RESET',
  'TOTP_ENABLE',
  'TOTP_DISABLE',
  'API_KEY_CREATED',
] as const;

@Controller('households/:hid/mail-templates')
@UseGuards(HouseholdMemberGuard)
export class MailTemplateController {
  constructor(private readonly service: MailTemplateService) {}

  @Get()
  async findMany(@ReqContext() ctx: RequestContext) {
    return this.service.findMany(ctx);
  }

  @Get(':type')
  async findByType(
    @ReqContext() ctx: RequestContext,
    @Param('type') type: string,
  ) {
    const validType = this.parseType(type);
    return this.service.findByType(ctx, validType);
  }

  @Post()
  async create(@ReqContext() ctx: RequestContext, @Body() dto: CreateMailTemplateDto) {
    return this.service.create(ctx, dto);
  }

  @Put(':type')
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('type') type: string,
    @Body() dto: UpdateMailTemplateDto,
  ) {
    const validType = this.parseType(type);
    return this.service.update(ctx, validType, dto);
  }

  @Delete(':type')
  async delete(
    @ReqContext() ctx: RequestContext,
    @Param('type') type: string,
  ) {
    const validType = this.parseType(type);
    await this.service.delete(ctx, validType);
    return { success: true };
  }

  private parseType(type: string): MailTemplateType {
    if (!VALID_TEMPLATE_TYPES.includes(type as MailTemplateType)) {
      throw new BadRequestException(`Ungültiger Typ: ${type}`);
    }
    return type as MailTemplateType;
  }
}