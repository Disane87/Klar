import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { HouseholdMailTemplate, MailTemplateType } from '@prisma/client';

@Injectable()
export class MailTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(householdId: string): Promise<HouseholdMailTemplate[]> {
    return this.prisma.householdMailTemplate.findMany({
      where: { householdId },
      orderBy: { templateType: 'asc' },
    });
  }

  async findByType(householdId: string, type: MailTemplateType): Promise<HouseholdMailTemplate | null> {
    return this.prisma.householdMailTemplate.findUnique({
      where: { householdId_templateType: { householdId, templateType: type } },
    });
  }

  async create(data: {
    householdId: string;
    templateType: MailTemplateType;
    name: string;
    subject: string;
    body: string;
  }): Promise<HouseholdMailTemplate> {
    return this.prisma.householdMailTemplate.create({ data });
  }

  async upsert(
    householdId: string,
    templateType: MailTemplateType,
    data: { name: string; subject: string; body: string },
  ): Promise<HouseholdMailTemplate> {
    return this.prisma.householdMailTemplate.upsert({
      where: { householdId_templateType: { householdId, templateType } },
      create: { householdId, templateType, ...data },
      update: data,
    });
  }

  async delete(householdId: string, type: MailTemplateType): Promise<void> {
    await this.prisma.householdMailTemplate.delete({
      where: { householdId_templateType: { householdId, templateType: type } },
    });
  }
}