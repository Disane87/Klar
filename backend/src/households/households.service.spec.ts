import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { HouseholdsService } from './households.service';
import { Household } from './household.entity';
import { HouseholdMember, HouseholdRole } from './household-member.entity';
import { IncomesService } from '../incomes/incomes.service';
import { BudgetsService } from '../budgets/budgets.service';

describe('HouseholdsService', () => {
  let service: HouseholdsService;
  let householdRepo: any;
  let memberRepo: any;
  let incomesService: any;
  let budgetsService: any;

  const mockHousehold: Partial<Household> = {
    id: 'house-1',
    name: 'Test Family',
    inviteCode: 'abc123',
  };

  const mockMember: Partial<HouseholdMember> = {
    householdId: 'house-1',
    userId: 'user-1',
    role: HouseholdRole.ADMIN,
    household: mockHousehold as Household,
    user: { id: 'user-1', displayName: 'Test User' } as any,
  };

  beforeEach(async () => {
    householdRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(mockHousehold),
      save: jest.fn().mockResolvedValue(mockHousehold),
    };

    memberRepo = {
      find: jest.fn().mockResolvedValue([mockMember]),
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(mockMember),
      save: jest.fn().mockResolvedValue(mockMember),
      delete: jest.fn(),
    };

    incomesService = {
      findByHousehold: jest.fn().mockResolvedValue([]),
    };

    budgetsService = {
      findByHousehold: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        { provide: getRepositoryToken(Household), useValue: householdRepo },
        { provide: getRepositoryToken(HouseholdMember), useValue: memberRepo },
        { provide: IncomesService, useValue: incomesService },
        { provide: BudgetsService, useValue: budgetsService },
      ],
    }).compile();

    service = module.get<HouseholdsService>(HouseholdsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForUser', () => {
    it('should return households the user belongs to', async () => {
      const result = await service.findAllForUser('user-1');
      expect(result).toEqual([mockHousehold]);
    });
  });

  describe('create', () => {
    it('should create a household and add creator as ADMIN', async () => {
      const result = await service.create('user-1', { name: 'New Family' });
      expect(householdRepo.save).toHaveBeenCalled();
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockHousehold);
    });
  });

  describe('join', () => {
    it('should throw NotFoundException for invalid invite code', async () => {
      householdRepo.findOne.mockResolvedValue(null);
      await expect(service.join('user-1', 'bad-code')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already a member', async () => {
      householdRepo.findOne.mockResolvedValue(mockHousehold);
      memberRepo.findOne.mockResolvedValue(mockMember);
      await expect(service.join('user-1', 'abc123')).rejects.toThrow(ConflictException);
    });

    it('should join successfully with valid invite code', async () => {
      householdRepo.findOne.mockResolvedValue(mockHousehold);
      memberRepo.findOne.mockResolvedValue(null);
      const result = await service.join('user-2', 'abc123');
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockHousehold);
    });
  });

  describe('removeMember', () => {
    it('should allow self-removal', async () => {
      memberRepo.findOne.mockResolvedValue(mockMember);
      memberRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.removeMember('house-1', 'user-1', 'user-1')).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException for non-admin removing others', async () => {
      memberRepo.findOne.mockResolvedValue({ ...mockMember, role: HouseholdRole.MEMBER });
      await expect(
        service.removeMember('house-1', 'user-2', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
