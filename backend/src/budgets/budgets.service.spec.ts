import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetEntry } from './budget-entry.entity';
import { IncomesService } from '../incomes/incomes.service';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let mockQueryBuilder: any;
  let repo: any;
  let incomesService: jest.Mocked<Partial<IncomesService>>;

  const mockEntry: Partial<BudgetEntry> = {
    id: 'entry-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    name: 'Netflix',
    amount: 15.99,
    isRecurring: true,
    month: 1,
    year: 2026,
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockEntry]),
      getRawOne: jest.fn().mockResolvedValue({ total: '500' }),
      getRawMany: jest.fn().mockResolvedValue([
        { categoryId: 'cat-1', categoryName: 'Subs', categoryIcon: 'tv', categoryColor: '#6366f1', total: '15.99' },
      ]),
    };

    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      create: jest.fn().mockReturnValue(mockEntry),
      save: jest.fn().mockResolvedValue(mockEntry),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    incomesService = {
      sumForUser: jest.fn().mockResolvedValue(3500),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: getRepositoryToken(BudgetEntry), useValue: repo },
        { provide: IncomesService, useValue: incomesService },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return budget entries for a user', async () => {
      const result = await service.findAll('user-1');
      expect(result).toEqual([mockEntry]);
    });
  });

  describe('create', () => {
    it('should create a budget entry', async () => {
      const dto = { name: 'Netflix', amount: 15.99, categoryId: 'cat-1', month: 1, year: 2026 };
      const result = await service.create('user-1', dto);
      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId: 'user-1' });
      expect(result).toEqual(mockEntry);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when entry not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-id', 'user-1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an entry', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove('entry-1', 'user-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when entry not found', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('should return a monthly summary', async () => {
      const result = await service.getSummary('user-1', 1, 2026);
      expect(result.totalIncome).toBe(3500);
      expect(result.totalExpenses).toBe(500);
      expect(result.remaining).toBe(3000);
      expect(result.categoryBreakdown).toHaveLength(1);
      expect(result.month).toBe(1);
      expect(result.year).toBe(2026);
    });
  });
});
