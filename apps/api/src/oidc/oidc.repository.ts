import { Injectable } from '@nestjs/common';
import type { OidcIdentity, OidcLoginState, OneTimeHandoverCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateOidcIdentityData {
  userId: string;
  providerName: string;
  oidcSub: string;
  email: string;
}

export interface CreateOidcLoginStateData {
  providerName: string;
  state: string;
  codeVerifier: string;
  redirectAfterLogin?: string;
  expiresAt: Date;
}

export interface CreateHandoverCodeData {
  code: string;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class OidcRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── OidcIdentity ──────────────────────────────────────────────────────────

  findIdentity(providerName: string, oidcSub: string): Promise<OidcIdentity | null> {
    return this.prisma.oidcIdentity.findUnique({
      where: { providerName_oidcSub: { providerName, oidcSub } },
    });
  }

  findIdentitiesByUser(userId: string): Promise<OidcIdentity[]> {
    return this.prisma.oidcIdentity.findMany({ where: { userId } });
  }

  countIdentitiesByUser(userId: string): Promise<number> {
    return this.prisma.oidcIdentity.count({ where: { userId } });
  }

  createIdentity(data: CreateOidcIdentityData): Promise<OidcIdentity> {
    return this.prisma.oidcIdentity.create({ data });
  }

  async updateIdentityLastLogin(id: string): Promise<void> {
    await this.prisma.oidcIdentity.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async deleteIdentity(userId: string, providerName: string): Promise<void> {
    await this.prisma.oidcIdentity.deleteMany({ where: { userId, providerName } });
  }

  // ── OidcLoginState ────────────────────────────────────────────────────────

  createLoginState(data: CreateOidcLoginStateData): Promise<OidcLoginState> {
    return this.prisma.oidcLoginState.create({ data });
  }

  findLoginState(state: string): Promise<OidcLoginState | null> {
    return this.prisma.oidcLoginState.findUnique({ where: { state } });
  }

  async deleteLoginState(id: string): Promise<void> {
    await this.prisma.oidcLoginState.delete({ where: { id } });
  }

  async cleanExpiredStates(): Promise<void> {
    await this.prisma.oidcLoginState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  // ── OneTimeHandoverCode ───────────────────────────────────────────────────

  createHandoverCode(data: CreateHandoverCodeData): Promise<OneTimeHandoverCode> {
    return this.prisma.oneTimeHandoverCode.create({ data });
  }

  findHandoverCode(code: string): Promise<OneTimeHandoverCode | null> {
    return this.prisma.oneTimeHandoverCode.findUnique({ where: { code } });
  }

  async markHandoverCodeUsed(id: string): Promise<void> {
    await this.prisma.oneTimeHandoverCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async cleanExpiredCodes(): Promise<void> {
    await this.prisma.oneTimeHandoverCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
