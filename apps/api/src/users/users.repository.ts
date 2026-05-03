import { Injectable } from '@nestjs/common';
import type { User, OidcIdentity } from '@prisma/client';
import { AppRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateUserData {
  email: string;
  displayName: string;
  passwordHash: string | null;
  appRole: AppRole;
  emailVerified?: boolean;
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
    return this.prisma.user.create({
      data: {
        email: data.email,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        appRole: data.appRole,
        emailVerified: data.emailVerified ?? false,
      },
    });
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

  async setAppRole(id: string, appRole: AppRole): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { appRole } });
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  findWithOidc(id: string): Promise<(User & { oidcIdentities: OidcIdentity[] }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { oidcIdentities: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async updateProfile(id: string, data: { displayName?: string; email?: string }): Promise<User> {
    const update: { displayName?: string; email?: string; emailVerified?: boolean } = {};
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.email !== undefined) {
      update.email = data.email.toLowerCase();
      update.emailVerified = false;
    }
    return this.prisma.user.update({ where: { id }, data: update });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async update(id: string, data: Partial<Pick<User, 'totpSecret' | 'totpEnabled'>>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }
}
