import { Injectable } from '@nestjs/common';
import type { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Safe view: omit hashedSecret — never returned to callers
export type ApiKeySafeView = Omit<ApiKey, 'hashedSecret'>;

export interface CreateApiKeyData {
  householdId: string;
  createdByUserId: string | null;
  name: string;
  prefix: string;
  hashedSecret: string;
  scopes: string[];
  expiresAt?: Date | null;
  rateLimitPerMin?: number;
}

@Injectable()
export class ApiKeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** List all non-revoked API keys for a household — never returns hashedSecret. */
  findAll(householdId: string): Promise<ApiKeySafeView[]> {
    return this.prisma.apiKey.findMany({
      where: { householdId, isRevoked: false },
      select: {
        id: true,
        householdId: true,
        createdByUserId: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        rateLimitPerMin: true,
        isRevoked: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Find a key by prefix for authentication — returns full record including hashedSecret. */
  findByPrefix(prefix: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findFirst({
      where: { prefix, isRevoked: false },
    });
  }

  /** Create a new API key record. */
  create(data: CreateApiKeyData): Promise<ApiKey> {
    return this.prisma.apiKey.create({
      data: {
        householdId: data.householdId,
        createdByUserId: data.createdByUserId,
        name: data.name,
        prefix: data.prefix,
        hashedSecret: data.hashedSecret,
        scopes: data.scopes,
        expiresAt: data.expiresAt ?? null,
        rateLimitPerMin: data.rateLimitPerMin ?? 60,
      },
    });
  }

  /** Soft-revoke a key by setting isRevoked=true. */
  revoke(id: string, householdId: string): Promise<ApiKey> {
    return this.prisma.apiKey.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  /**
   * Fire-and-forget: update lastUsedAt + lastUsedIp.
   * Only updates if lastUsedAt is null or more than 1 minute ago (throttle).
   */
  updateLastUsed(id: string, ip?: string): void {
    this.prisma.apiKey
      .findUnique({ where: { id }, select: { lastUsedAt: true } })
      .then((record) => {
        if (!record) return;
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60_000);
        if (record.lastUsedAt === null || record.lastUsedAt < oneMinuteAgo) {
          return this.prisma.apiKey.update({
            where: { id },
            data: { lastUsedAt: now, lastUsedIp: ip ?? null },
          });
        }
        return;
      })
      .catch(() => {
        // fire-and-forget — never block the request path
      });
  }

  /** Hard-delete an API key. */
  delete(id: string, householdId: string): Promise<ApiKey> {
    return this.prisma.apiKey.delete({ where: { id } });
  }
}
