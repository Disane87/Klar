import { Injectable } from '@nestjs/common';
import { MailTemplateRepository } from './mail-template.repository';
import type { RequestContext } from '../common/types/request-context.type';
import type { HouseholdMailTemplate, MailTemplateType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export interface CreateMailTemplateDto {
  templateType: MailTemplateType;
  name: string;
  subject: string;
  body: string;
}

export interface UpdateMailTemplateDto {
  name?: string;
  subject?: string;
  body?: string;
}

@Injectable()
export class MailTemplateService {
  constructor(private readonly repo: MailTemplateRepository) {}

  async findMany(ctx: RequestContext): Promise<HouseholdMailTemplate[]> {
    return this.repo.findMany(ctx.householdId);
  }

  async findByType(
    ctx: RequestContext,
    type: MailTemplateType,
  ): Promise<HouseholdMailTemplate | null> {
    return this.repo.findByType(ctx.householdId, type);
  }

  async create(
    ctx: RequestContext,
    dto: CreateMailTemplateDto,
  ): Promise<HouseholdMailTemplate> {
    if (!dto.name?.trim()) throw new BadRequestException('Name ist erforderlich');
    if (!dto.subject?.trim()) throw new BadRequestException('Betreff ist erforderlich');
    if (!dto.body?.trim()) throw new BadRequestException('Inhalt ist erforderlich');

    return this.repo.create({
      householdId: ctx.householdId,
      templateType: dto.templateType,
      name: dto.name,
      subject: dto.subject,
      body: dto.body,
    });
  }

  async update(
    ctx: RequestContext,
    templateType: MailTemplateType,
    dto: UpdateMailTemplateDto,
  ): Promise<HouseholdMailTemplate> {
    if (!dto.name?.trim() && !dto.subject?.trim() && !dto.body?.trim()) {
      throw new BadRequestException('Mindestens ein Feld muss angegeben werden');
    }

    return this.repo.upsert(ctx.householdId, templateType, {
      name: dto.name ?? '',
      subject: dto.subject ?? '',
      body: dto.body ?? '',
    });
  }

  async delete(ctx: RequestContext, type: MailTemplateType): Promise<void> {
    await this.repo.delete(ctx.householdId, type);
  }
}