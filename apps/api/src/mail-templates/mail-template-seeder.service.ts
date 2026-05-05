import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_MAIL_TEMPLATES } from './default-mail-templates';

/**
 * Runs once on every application start.
 * Inserts missing default mail templates for every household.
 * Safe to call repeatedly — skipDuplicates guarantees idempotency.
 */
@Injectable()
export class MailTemplateSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailTemplateSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const households = await this.prisma.household.findMany({ select: { id: true } });

    if (households.length === 0) return;

    let total = 0;
    for (const { id } of households) {
      const result = await this.prisma.householdMailTemplate.createMany({
        data: DEFAULT_MAIL_TEMPLATES.map(t => ({
          householdId:  id,
          templateType: t.templateType,
          name:         t.name,
          subject:      t.subject,
          body:         t.body,
          isActive:     true,
        })),
        skipDuplicates: true,
      });
      total += result.count;
    }

    if (total > 0) {
      this.logger.log(`Delivery seed: ${total} Mail-Template(s) für ${households.length} Haushalt(e) angelegt`);
    }
  }
}
