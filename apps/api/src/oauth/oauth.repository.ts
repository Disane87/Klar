import { Injectable } from '@nestjs/common';
import type { OAuthClient, OAuthAuthCode, OAuthGrant, OAuthConsent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateClientData {
  clientId: string;
  clientSecretHash: string | null;
  clientName: string;
  redirectUris: string[];
  logoUri?: string | null;
  clientUri?: string | null;
  tosUri?: string | null;
  policyUri?: string | null;
  tokenEndpointAuthMethod: 'none' | 'client_secret_post';
  registrationAccessTokenHash: string | null;
}

export interface CreateAuthCodeData {
  codeHash: string;
  clientId: string;
  userId: string;
  householdId: string;
  scopes: string[];
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: Date;
}

export interface CreateGrantData {
  clientId: string;
  userId: string;
  householdId: string;
  scopes: string[];
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class OAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Clients ────────────────────────────────────────────────────────────
  createClient(data: CreateClientData): Promise<OAuthClient> {
    return this.prisma.oAuthClient.create({
      data: {
        clientId: data.clientId,
        clientSecretHash: data.clientSecretHash,
        clientName: data.clientName,
        redirectUris: data.redirectUris,
        logoUri: data.logoUri ?? null,
        clientUri: data.clientUri ?? null,
        tosUri: data.tosUri ?? null,
        policyUri: data.policyUri ?? null,
        tokenEndpointAuthMethod: data.tokenEndpointAuthMethod,
        registrationAccessTokenHash: data.registrationAccessTokenHash,
      },
    });
  }

  findClientByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.prisma.oAuthClient.findUnique({ where: { clientId } });
  }

  // ── Auth Codes ─────────────────────────────────────────────────────────
  createAuthCode(data: CreateAuthCodeData): Promise<OAuthAuthCode> {
    return this.prisma.oAuthAuthCode.create({
      data: {
        code: data.codeHash,
        clientId: data.clientId,
        userId: data.userId,
        householdId: data.householdId,
        scopes: data.scopes,
        redirectUri: data.redirectUri,
        codeChallenge: data.codeChallenge,
        codeChallengeMethod: data.codeChallengeMethod,
        expiresAt: data.expiresAt,
      },
    });
  }

  findAuthCodeByHash(codeHash: string): Promise<OAuthAuthCode | null> {
    return this.prisma.oAuthAuthCode.findUnique({ where: { code: codeHash } });
  }

  /**
   * Markiert Code als verbraucht. Verwendet ein optimistisches Update auf
   * (code, consumedAt: null), damit Replay-Versuche aus parallelen Requests
   * 0 betroffene Zeilen zurückgeben.
   */
  async consumeAuthCode(codeHash: string): Promise<boolean> {
    const result = await this.prisma.oAuthAuthCode.updateMany({
      where: { code: codeHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  /** Cascade-Revoke aller Grants eines Clients (Reaktion auf Code-Replay). */
  revokeAllGrantsForClient(clientId: string): Promise<{ count: number }> {
    return this.prisma.oAuthGrant.updateMany({
      where: { clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Grants ─────────────────────────────────────────────────────────────
  createGrant(data: CreateGrantData): Promise<OAuthGrant> {
    return this.prisma.oAuthGrant.create({ data });
  }

  findGrantByRefreshHash(refreshTokenHash: string): Promise<OAuthGrant | null> {
    return this.prisma.oAuthGrant.findUnique({ where: { refreshTokenHash } });
  }

  findActiveGrant(userId: string, clientId: string): Promise<OAuthGrant | null> {
    return this.prisma.oAuthGrant.findFirst({
      where: { userId, clientId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listUserGrants(userId: string): Promise<(OAuthGrant & { client: OAuthClient })[]> {
    return this.prisma.oAuthGrant.findMany({
      where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  revokeGrant(id: string): Promise<OAuthGrant> {
    return this.prisma.oAuthGrant.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  touchGrant(id: string): Promise<OAuthGrant> {
    return this.prisma.oAuthGrant.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  // ── Consents ───────────────────────────────────────────────────────────
  upsertConsent(userId: string, clientId: string, scopes: string[]): Promise<OAuthConsent> {
    return this.prisma.oAuthConsent.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId, scopes },
      update: { scopes, grantedAt: new Date() },
    });
  }

  findConsent(userId: string, clientId: string): Promise<OAuthConsent | null> {
    return this.prisma.oAuthConsent.findUnique({
      where: { userId_clientId: { userId, clientId } },
    });
  }

  deleteConsent(userId: string, clientId: string): Promise<{ count: number }> {
    return this.prisma.oAuthConsent.deleteMany({ where: { userId, clientId } });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  deleteExpiredAuthCodes(now: Date): Promise<{ count: number }> {
    return this.prisma.oAuthAuthCode.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }

  deleteExpiredGrants(olderThan: Date): Promise<{ count: number }> {
    return this.prisma.oAuthGrant.deleteMany({
      where: {
        OR: [
          { refreshExpiresAt: { lt: olderThan } },
          { revokedAt: { lt: olderThan } },
        ],
      },
    });
  }
}
