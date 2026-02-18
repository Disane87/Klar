import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockUser: User = {
    id: 'user-1',
    oidcSubject: 'sub-123',
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
    usersService = {
      findByOidcSubject: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-value') } },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateOidcUser', () => {
    it('should return existing user if found', async () => {
      usersService.findByOidcSubject!.mockResolvedValue(mockUser);

      const result = await service.validateOidcUser({
        sub: 'sub-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result).toEqual(mockUser);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should create a new user if not found', async () => {
      usersService.findByOidcSubject!.mockResolvedValue(null);
      usersService.create!.mockResolvedValue(mockUser);

      const result = await service.validateOidcUser({
        sub: 'sub-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(usersService.create).toHaveBeenCalledWith({
        oidcSubject: 'sub-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('getOidcConfig', () => {
    it('should return OIDC configuration', () => {
      const config = service.getOidcConfig();
      expect(config).toHaveProperty('authority');
      expect(config).toHaveProperty('clientId');
      expect(config).toHaveProperty('redirectUri');
      expect(config).toHaveProperty('scope');
    });
  });
});
