import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Partial<Repository<User>>>;

  const mockUser: User = {
    id: 'user-1',
    oidcSubject: 'oidc-sub-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    incomes: [],
    budgetEntries: [],
    householdMemberships: [],
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByOidcSubject', () => {
    it('should return a user when found', async () => {
      repo.findOne!.mockResolvedValue(mockUser);
      const result = await service.findByOidcSubject('oidc-sub-123');
      expect(result).toEqual(mockUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { oidcSubject: 'oidc-sub-123' } });
    });

    it('should return null when user not found', async () => {
      repo.findOne!.mockResolvedValue(null);
      const result = await service.findByOidcSubject('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user by ID', async () => {
      repo.findOne!.mockResolvedValue(mockUser);
      const result = await service.findById('user-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const createData = {
        oidcSubject: 'new-sub',
        email: 'new@example.com',
        displayName: 'New User',
        avatarUrl: null,
      };
      repo.create!.mockReturnValue({ ...mockUser, ...createData } as User);
      repo.save!.mockResolvedValue({ ...mockUser, ...createData } as User);

      const result = await service.create(createData);
      expect(repo.create).toHaveBeenCalledWith(createData);
      expect(repo.save).toHaveBeenCalled();
      expect(result.email).toBe('new@example.com');
    });
  });
});
