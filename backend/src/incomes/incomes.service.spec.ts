import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { IncomesService } from './incomes.service';
import { Income } from './income.entity';

describe('IncomesService', () => {
  let service: IncomesService;
  let mockQueryBuilder: any;
  let repo: any;

  const mockIncome: Partial<Income> = {
    id: 'income-1',
    userId: 'user-1',
    name: 'Salary',
    amount: 3500,
    month: 1,
    year: 2026,
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockIncome]),
      getRawOne: jest.fn().mockResolvedValue({ total: '3500' }),
    };

    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      create: jest.fn().mockReturnValue(mockIncome),
      save: jest.fn().mockResolvedValue(mockIncome),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncomesService,
        { provide: getRepositoryToken(Income), useValue: repo },
      ],
    }).compile();

    service = module.get<IncomesService>(IncomesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return incomes for a user', async () => {
      const result = await service.findAll('user-1');
      expect(result).toEqual([mockIncome]);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('income');
    });

    it('should filter by month and year when provided', async () => {
      await service.findAll('user-1', 1, 2026);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('create', () => {
    it('should create an income entry', async () => {
      const dto = { name: 'Salary', amount: 3500, month: 1, year: 2026 };
      const result = await service.create('user-1', dto);
      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId: 'user-1' });
      expect(result).toEqual(mockIncome);
    });
  });

  describe('update', () => {
    it('should update an existing income', async () => {
      repo.findOne.mockResolvedValue({ ...mockIncome });
      const result = await service.update('income-1', 'user-1', { name: 'Updated' });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when income not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-id', 'user-1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an income', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove('income-1', 'user-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when income not found', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sumForUser', () => {
    it('should return the sum of incomes', async () => {
      const result = await service.sumForUser('user-1', 1, 2026);
      expect(result).toBe(3500);
    });
  });
});
