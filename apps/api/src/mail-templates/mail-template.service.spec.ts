import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MailTemplateService } from './mail-template.service';
import type { MailTemplateRepository } from './mail-template.repository';
import type { HouseholdMailTemplate } from '@prisma/client';
import { MailTemplateType } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeTemplate = (overrides: Partial<HouseholdMailTemplate> = {}): HouseholdMailTemplate => ({
  id: 'tpl-1',
  householdId: 'hh1',
  templateType: MailTemplateType.INVITE,
  name: 'Einladung',
  subject: 'Betreff',
  body: '<html>...</html>',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

function buildService(): { service: MailTemplateService; repo: MailTemplateRepository } {
  const repo = {
    findMany: vi.fn(),
    findByType: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  } as unknown as MailTemplateRepository;

  const service = new MailTemplateService(repo);
  return { service, repo };
}

describe('MailTemplateService', () => {
  describe('findMany', () => {
    it('delegates to repo.findMany with householdId', async () => {
      const { service, repo } = buildService();
      const templates = [makeTemplate()];
      vi.mocked(repo.findMany).mockResolvedValue(templates);

      const result = await service.findMany(ctx);

      expect(repo.findMany).toHaveBeenCalledWith('hh1');
      expect(result).toBe(templates);
    });
  });

  describe('findByType', () => {
    it('delegates to repo.findByType with householdId and type', async () => {
      const { service, repo } = buildService();
      const template = makeTemplate();
      vi.mocked(repo.findByType).mockResolvedValue(template);

      const result = await service.findByType(ctx, MailTemplateType.INVITE);

      expect(repo.findByType).toHaveBeenCalledWith('hh1', MailTemplateType.INVITE);
      expect(result).toBe(template);
    });

    it('returns null when type not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findByType).mockResolvedValue(null);

      const result = await service.findByType(ctx, MailTemplateType.REMINDER);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('throws BadRequestException when name is empty', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, { templateType: MailTemplateType.INVITE, name: '', subject: 'S', body: 'B' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when name is whitespace only', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, { templateType: MailTemplateType.INVITE, name: '   ', subject: 'S', body: 'B' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when subject is empty', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, { templateType: MailTemplateType.INVITE, name: 'N', subject: '', body: 'B' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when body is empty', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, { templateType: MailTemplateType.INVITE, name: 'N', subject: 'S', body: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls repo.create with correct data on valid input', async () => {
      const { service, repo } = buildService();
      const template = makeTemplate();
      vi.mocked(repo.create).mockResolvedValue(template);

      const result = await service.create(ctx, {
        templateType: MailTemplateType.INVITE,
        name: 'Einladung',
        subject: 'Betreff',
        body: '<html/>',
      });

      expect(repo.create).toHaveBeenCalledWith({
        householdId: 'hh1',
        templateType: MailTemplateType.INVITE,
        name: 'Einladung',
        subject: 'Betreff',
        body: '<html/>',
      });
      expect(result).toBe(template);
    });
  });

  describe('update', () => {
    it('throws BadRequestException when all fields are empty', async () => {
      const { service } = buildService();
      await expect(
        service.update(ctx, MailTemplateType.INVITE, { name: '', subject: '', body: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls repo.upsert when at least one field is provided', async () => {
      const { service, repo } = buildService();
      const template = makeTemplate({ subject: 'Neuer Betreff' });
      vi.mocked(repo.upsert).mockResolvedValue(template);

      const result = await service.update(ctx, MailTemplateType.INVITE, {
        subject: 'Neuer Betreff',
      });

      expect(repo.upsert).toHaveBeenCalledWith('hh1', MailTemplateType.INVITE, {
        name: '',
        subject: 'Neuer Betreff',
        body: '',
      });
      expect(result).toBe(template);
    });

    it('passes undefined fields as empty string to repo.upsert', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.upsert).mockResolvedValue(makeTemplate());

      await service.update(ctx, MailTemplateType.REMINDER, { name: 'Neuer Name' });

      expect(repo.upsert).toHaveBeenCalledWith('hh1', MailTemplateType.REMINDER, {
        name: 'Neuer Name',
        subject: '',
        body: '',
      });
    });
  });

  describe('delete', () => {
    it('delegates to repo.delete with householdId and type', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.delete).mockResolvedValue(undefined);

      await service.delete(ctx, MailTemplateType.INVITE);

      expect(repo.delete).toHaveBeenCalledWith('hh1', MailTemplateType.INVITE);
    });
  });
});
