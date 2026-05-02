import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectStatus, Visibility } from '@prisma/client';
import { ProjectsService } from './projects.service';
import type { ProjectsRepository } from './projects.repository';
import type { Project } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  name: 'Urlaub',
  description: null,
  status: ProjectStatus.ACTIVE,
  totalBudgetCents: null,
  startDate: null,
  endDate: null,
  color: '#f472b6',
  visibility: Visibility.SHARED,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

function buildService() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    hasTransactions: vi.fn(),
  } as unknown as ProjectsRepository;
  const service = new ProjectsService(repo);
  return { service, repo };
}

describe('ProjectsService', () => {
  describe('list', () => {
    it('delegates to repo.findAll with householdId and userId', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx);
      expect(repo.findAll).toHaveBeenCalledWith('hh1', { userId: 'u1' });
    });

    it('passes status filter when provided', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx, { status: ProjectStatus.ACTIVE });
      expect(repo.findAll).toHaveBeenCalledWith('hh1', {
        status: ProjectStatus.ACTIVE,
        userId: 'u1',
      });
    });
  });

  describe('create', () => {
    it('creates project with trimmed name and defaults', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeProject());
      await service.create(ctx, { name: '  Urlaub  ', color: '#f472b6' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Urlaub',
          status: ProjectStatus.ACTIVE,
          visibility: Visibility.SHARED,
          createdByUserId: 'u1',
          householdId: 'hh1',
        }),
      );
    });

    it('parses ISO date strings to Date objects', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeProject());
      await service.create(ctx, {
        name: 'Trip',
        color: '#fff',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      });
      const call = vi.mocked(repo.create).mock.calls[0][0];
      expect(call.startDate).toBeInstanceOf(Date);
      expect(call.endDate).toBeInstanceOf(Date);
    });

    it('keeps null dates when not provided', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeProject());
      await service.create(ctx, { name: 'Trip', color: '#fff' });
      const call = vi.mocked(repo.create).mock.calls[0][0];
      expect(call.startDate).toBeNull();
      expect(call.endDate).toBeNull();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when project not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update(ctx, 'proj-99', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when updating PRIVATE project of another user', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeProject({ visibility: Visibility.PRIVATE, createdByUserId: 'other-user' }),
      );
      await expect(service.update(ctx, 'proj-1', { name: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows updating own PRIVATE project', async () => {
      const { service, repo } = buildService();
      const proj = makeProject({ visibility: Visibility.PRIVATE, createdByUserId: 'u1' });
      vi.mocked(repo.findById).mockResolvedValue(proj);
      vi.mocked(repo.update).mockResolvedValue({ ...proj, name: 'Updated' });
      const result = await service.update(ctx, 'proj-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('allows updating SHARED project regardless of creator', async () => {
      const { service, repo } = buildService();
      const proj = makeProject({ visibility: Visibility.SHARED, createdByUserId: 'other-user' });
      vi.mocked(repo.findById).mockResolvedValue(proj);
      vi.mocked(repo.update).mockResolvedValue({ ...proj, name: 'Updated' });
      const result = await service.update(ctx, 'proj-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when project not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.remove(ctx, 'proj-99')).rejects.toThrow(NotFoundException);
    });

    it('archives when transactions exist', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeProject());
      vi.mocked(repo.hasTransactions).mockResolvedValue(true);
      vi.mocked(repo.update).mockResolvedValue(makeProject({ status: ProjectStatus.ARCHIVED }));
      await service.remove(ctx, 'proj-1');
      expect(repo.update).toHaveBeenCalledWith('proj-1', { status: ProjectStatus.ARCHIVED });
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('hard-deletes when no transactions exist', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeProject());
      vi.mocked(repo.hasTransactions).mockResolvedValue(false);
      vi.mocked(repo.delete).mockResolvedValue(makeProject());
      await service.remove(ctx, 'proj-1');
      expect(repo.delete).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('toResponse', () => {
    it('serializes dates to YYYY-MM-DD strings', () => {
      const { service } = buildService();
      const result = service.toResponse(
        makeProject({
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-30'),
        }),
      );
      expect(result.startDate).toBe('2026-06-01');
      expect(result.endDate).toBe('2026-06-30');
    });

    it('returns null for null dates', () => {
      const { service } = buildService();
      const result = service.toResponse(makeProject({ startDate: null, endDate: null }));
      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
    });
  });
});
