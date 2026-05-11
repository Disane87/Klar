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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MailTemplateService } from './mail-template.service';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { ReqContext } from '../common/decorators/req-context.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import type { MailTemplateType } from '@prisma/client';
import { CreateMailTemplateDto, UpdateMailTemplateDto } from './mail-template.service';
import {
  CreateMailTemplateBodyDto,
  UpdateMailTemplateBodyDto,
} from './dto/mail-template.dto';
import {
  MailTemplateDeleteResponse,
  MailTemplateResponse,
} from './dto/responses/mail-template.response';

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

@ApiTags('Admin · Mail Templates')
@ApiBearerAuth('jwt')
@Controller('households/:hid/mail-templates')
@UseGuards(HouseholdMemberGuard)
@ApiParam({
  name: 'hid',
  description: 'Household ID — usually injected by HouseholdMemberGuard from the URL.',
  example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
})
export class MailTemplateController {
  constructor(private readonly service: MailTemplateService) {}

  @Get()
  @ApiOperation({
    summary: 'List household mail templates',
    description:
      'Returns every mail-template override configured for this household. Caller must be a household member. Templates without an override fall back to the built-in defaults from `default-mail-templates.ts`.',
  })
  @ApiResponse({ status: 200, type: MailTemplateResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async findMany(@ReqContext() ctx: RequestContext) {
    return this.service.findMany(ctx);
  }

  @Get(':type')
  @ApiOperation({
    summary: 'Get one mail template by type',
    description:
      'Returns the household-specific override for the given template type, or `null` if none is set (the built-in default is used at send time).',
  })
  @ApiParam({
    name: 'type',
    description: 'Built-in template slot.',
    enum: VALID_TEMPLATE_TYPES,
    example: 'INVITE',
  })
  @ApiResponse({ status: 200, type: MailTemplateResponse })
  @ApiResponse({ status: 400, description: 'Unknown template type.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async findByType(
    @ReqContext() ctx: RequestContext,
    @Param('type') type: string,
  ) {
    const validType = this.parseType(type);
    return this.service.findByType(ctx, validType);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a household mail template',
    description:
      'Creates a household-specific override for one of the built-in template slots. Subject and body support `{{handlebars}}` placeholders.',
  })
  @ApiBody({ type: CreateMailTemplateBodyDto })
  @ApiResponse({ status: 201, type: MailTemplateResponse })
  @ApiResponse({ status: 400, description: 'Validation failed (missing name/subject/body or unknown template type).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async create(@ReqContext() ctx: RequestContext, @Body() dto: CreateMailTemplateDto) {
    return this.service.create(ctx, dto);
  }

  @Put(':type')
  @ApiOperation({
    summary: 'Upsert a household mail template',
    description:
      'Updates (or creates) the household override for the given template type. At least one of `name`, `subject`, `body` must be present.',
  })
  @ApiParam({ name: 'type', enum: VALID_TEMPLATE_TYPES, example: 'INVITE' })
  @ApiBody({ type: UpdateMailTemplateBodyDto })
  @ApiResponse({ status: 200, type: MailTemplateResponse })
  @ApiResponse({ status: 400, description: 'Validation failed or unknown template type.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('type') type: string,
    @Body() dto: UpdateMailTemplateDto,
  ) {
    const validType = this.parseType(type);
    return this.service.update(ctx, validType, dto);
  }

  @Delete(':type')
  @ApiOperation({
    summary: 'Delete a household mail template',
    description:
      'Removes the household-specific override; the built-in default takes over for the given type on the next send.',
  })
  @ApiParam({ name: 'type', enum: VALID_TEMPLATE_TYPES, example: 'INVITE' })
  @ApiResponse({ status: 200, type: MailTemplateDeleteResponse })
  @ApiResponse({ status: 400, description: 'Unknown template type.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the household.' })
  @ApiResponse({ status: 404, description: 'No override exists for this type.' })
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
