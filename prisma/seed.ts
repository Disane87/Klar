import { PrismaClient, AppRole, HouseholdRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    console.warn('Seed wird in Production nicht ausgeführt.');
    return;
  }

  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    console.log(`Seed übersprungen — ${existingCount} User bereits vorhanden.`);
    return;
  }

  const passwordHash = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@klar.dev',
      displayName: 'Admin',
      passwordHash,
      appRole: AppRole.ADMIN,
      emailVerified: true,
    },
  });

  const household = await prisma.household.create({
    data: { name: 'Mein Haushalt' },
  });

  await prisma.householdMembership.create({
    data: {
      userId: admin.id,
      householdId: household.id,
      role: HouseholdRole.OWNER,
    },
  });

  console.log(`✅ Seed abgeschlossen.`);
  console.log(`   Admin: admin@klar.dev / password123`);
  console.log(`   Haushalt: ${household.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
