import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AppRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateUserData {
  email: string;
  displayName: string;
  passwordHash: string;
  appRole: AppRole;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.prisma.user
      .count({ where: { email } })
      .then((count) => count > 0);
  }

  countAll(): Promise<number> {
    return this.prisma.user.count();
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async setEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true },
    });
  }
}
