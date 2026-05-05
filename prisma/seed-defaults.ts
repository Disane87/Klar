/**
 * Delivery seed — runs on every installation and update.
 * Safe to run multiple times (skipDuplicates).
 *
 * Usage:
 *   pnpm --filter api prisma:seed:defaults
 *
 * Docker entrypoint (after migrate deploy):
 *   tsx ../../prisma/seed-defaults.ts
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_MAIL_TEMPLATES } from '../apps/api/src/mail-templates/default-mail-templates';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const households = await prisma.household.findMany({ select: { id: true, name: true } });

  if (households.length === 0) {
    console.log('seed-defaults: keine Haushalte vorhanden, übersprungen.');
    return;
  }

  let created = 0;

  for (const household of households) {
    const result = await prisma.householdMailTemplate.createMany({
      data: DEFAULT_MAIL_TEMPLATES.map(t => ({
        householdId:  household.id,
        templateType: t.templateType,
        name:         t.name,
        subject:      t.subject,
        body:         t.body,
        isActive:     true,
      })),
      skipDuplicates: true,
    });
    if (result.count > 0) {
      console.log(`  "${household.name}" — ${result.count} Template(s) angelegt`);
      created += result.count;
    }
  }

  if (created === 0) {
    console.log('seed-defaults: alle Templates bereits vorhanden, nichts geändert.');
  } else {
    console.log(`seed-defaults: ${created} Template(s) für ${households.length} Haushalt(e) angelegt.`);
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
