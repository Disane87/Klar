import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthUser } from '@klar/shared';
import { UsersRepository, type CreateUserData } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException(`User ${id} nicht gefunden`);
    return user;
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.repo.existsByEmail(email);
  }

  countAll(): Promise<number> {
    return this.repo.countAll();
  }

  create(data: CreateUserData): Promise<User> {
    return this.repo.create(data);
  }

  updateLastLogin(id: string): Promise<void> {
    return this.repo.updateLastLogin(id);
  }

  setEmailVerified(id: string): Promise<void> {
    return this.repo.setEmailVerified(id);
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      appRole: user.appRole,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
