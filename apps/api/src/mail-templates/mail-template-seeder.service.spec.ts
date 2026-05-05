import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailTemplateSeederService } from './mail-template-seeder.service';
import { DEFAULT_MAIL_TEMPLATES } from './default-mail-templates';
import type { PrismaService } from '../prisma/prisma.service';

function buildSeeder(prismaOverrides: Record<string, unknown> = {}): {
  seeder: MailTemplateSeederService;
  prisma: PrismaService;
} {
  const prisma = {
    household: { findMany: vi.fn() },
    householdMailTemplate: { createMany: vi.fn() },
    ...prismaOverrides,
  } as unknown as PrismaService;

  const seeder = new MailTemplateSeederService(prisma);
  return { seeder, prisma };
}

describe('MailTemplateSeederService', () => {
  describe('onApplicationBootstrap', () => {
    it('returns early and does not call createMany when no households exist', async () => {
      const { seeder, prisma } = buildSeeder();
      vi.mocked(prisma.household.findMany).mockResolvedValue([]);

      await seeder.onApplicationBootstrap();

      expect(prisma.householdMailTemplate.createMany).not.toHaveBeenCalled();
    });

    it('calls createMany for each household with all default templates', async () => {
      const { seeder, prisma } = buildSeeder();
      vi.mocked(prisma.household.findMany).mockResolvedValue([{ id: 'hh1' }, { id: 'hh2' }] as any);
      vi.mocked(prisma.householdMailTemplate.createMany).mockResolvedValue({ count: 0 });

      await seeder.onApplicationBootstrap();

      expect(prisma.householdMailTemplate.createMany).toHaveBeenCalledTimes(2);

      const firstCall = vi.mocked(prisma.householdMailTemplate.createMany).mock.calls[0][0];
      expect(firstCall?.skipDuplicates).toBe(true);
      expect(firstCall?.data).toHaveLength(DEFAULT_MAIL_TEMPLATES.length);
      expect((firstCall?.data as any)[0].householdId).toBe('hh1');
    });

    it('includes all required fields in createMany data', async () => {
      const { seeder, prisma } = buildSeeder();
      vi.mocked(prisma.household.findMany).mockResolvedValue([{ id: 'hh1' }] as any);
      vi.mocked(prisma.householdMailTemplate.createMany).mockResolvedValue({ count: 8 });

      await seeder.onApplicationBootstrap();

      const call = vi.mocked(prisma.householdMailTemplate.createMany).mock.calls[0][0];
      const firstEntry = (call?.data as any)[0];
      expect(firstEntry).toMatchObject({
        householdId: 'hh1',
        isActive: true,
      });
      expect(firstEntry.templateType).toBeDefined();
      expect(firstEntry.name).toBeDefined();
      expect(firstEntry.subject).toBeDefined();
      expect(firstEntry.body).toBeDefined();
    });

    it('uses skipDuplicates for idempotency', async () => {
      const { seeder, prisma } = buildSeeder();
      vi.mocked(prisma.household.findMany).mockResolvedValue([{ id: 'hh1' }] as any);
      vi.mocked(prisma.householdMailTemplate.createMany).mockResolvedValue({ count: 0 });

      await seeder.onApplicationBootstrap();

      const call = vi.mocked(prisma.householdMailTemplate.createMany).mock.calls[0][0];
      expect(call?.skipDuplicates).toBe(true);
    });
  });
});
