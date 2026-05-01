import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import type { RequestContext } from '../common/types/request-context.type';
import { ApiKeysRepository, type ApiKeySafeView } from './api-keys.repository';
import { API_KEY_SCOPES, type ApiKeyScope } from './api-key-scopes';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

// Public-safe shape returned to API consumers (no hashedSecret, no prefix details)
export interface ApiKeyListItem {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimitPerMin: number;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string | null;
  rateLimitPerMin?: number;
}

export interface CreateApiKeyResult extends ApiKeyListItem {
  /** Full key shown ONCE on creation, never stored or returned again. */
  fullKey: string;
}

export interface VerifyKeyResult {
  householdId: string;
  scopes: string[];
  apiKeyId: string;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly repo: ApiKeysRepository) {}

  /** List all active API keys for the household — safe view only. */
  async list(ctx: RequestContext): Promise<ApiKeyListItem[]> {
    const records = await this.repo.findAll(ctx.householdId);
    return records.map((r) => this.toListItem(r));
  }

  /** Generate and store a new API key. Returns fullKey ONCE — never stored in plaintext. */
  async create(ctx: RequestContext, input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    if (!input.name?.trim()) {
      throw new BadRequestException('Name ist erforderlich');
    }

    // Validate scopes
    const invalidScopes = input.scopes.filter((s) => !API_KEY_SCOPES.includes(s as ApiKeyScope));
    if (invalidScopes.length > 0) {
      throw new BadRequestException(`Ungültige Scopes: ${invalidScopes.join(', ')}`);
    }
    if (input.scopes.length === 0) {
      throw new BadRequestException('Mindestens ein Scope ist erforderlich');
    }

    // Generate: 40 random bytes → 80 hex chars
    const raw = crypto.randomBytes(40).toString('hex');
    const prefix = raw.slice(0, 8);
    const secret = raw.slice(8);
    const fullKey = `bgb_live_${raw}`;

    // Hash the secret part with Argon2id
    const hashedSecret = await argon2.hash(secret, ARGON2_OPTIONS);

    // Parse expiresAt
    let expiresAt: Date | null = null;
    if (input.expiresAt) {
      expiresAt = new Date(input.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        throw new BadRequestException('Ungültiges expiresAt-Datum');
      }
    }

    const record = await this.repo.create({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: input.name.trim(),
      prefix,
      hashedSecret,
      scopes: input.scopes,
      expiresAt,
      rateLimitPerMin: input.rateLimitPerMin ?? 60,
    });

    return {
      ...this.toListItem(record),
      fullKey,
    };
  }

  /** Revoke (soft-delete) an API key. */
  async revoke(ctx: RequestContext, id: string): Promise<void> {
    // Verify ownership before revoking
    const records = await this.repo.findAll(ctx.householdId);
    const existing = records.find((r) => r.id === id);
    if (!existing) {
      throw new NotFoundException(`API-Key ${id} nicht gefunden`);
    }

    await this.repo.revoke(id, ctx.householdId);
  }

  /** Hard-delete an API key from the database. */
  async remove(ctx: RequestContext, id: string): Promise<void> {
    // Verify ownership before deleting
    const records = await this.repo.findAll(ctx.householdId);
    const existing = records.find((r) => r.id === id);
    if (!existing) {
      throw new NotFoundException(`API-Key ${id} nicht gefunden`);
    }

    await this.repo.delete(id, ctx.householdId);
  }

  /**
   * Verify a full API key string (used by ApiKeyAuthGuard).
   * Returns null if invalid — NEVER throw an exception to prevent timing leaks.
   * NEVER log the full key.
   */
  async verifyKey(fullKey: string): Promise<VerifyKeyResult | null> {
    if (!fullKey.startsWith('bgb_live_')) return null;

    const rest = fullKey.slice('bgb_live_'.length);
    if (rest.length < 9) return null; // must have at least prefix (8) + 1 char secret

    const prefix = rest.slice(0, 8);
    const secret = rest.slice(8);

    // Lookup by prefix (safe to log prefix for troubleshooting)
    const record = await this.repo.findByPrefix(prefix);
    if (!record) return null;

    // Check revoked and expiry
    if (record.isRevoked) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Verify the secret against the stored Argon2 hash
    let valid = false;
    try {
      valid = await argon2.verify(record.hashedSecret, secret);
    } catch {
      return null;
    }

    if (!valid) return null;

    // Fire-and-forget last-used update — never blocks the request
    this.repo.updateLastUsed(record.id);

    return {
      householdId: record.householdId,
      scopes: record.scopes,
      apiKeyId: record.id,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private toListItem(r: ApiKeySafeView): ApiKeyListItem {
    return {
      id: r.id,
      name: r.name,
      scopes: r.scopes,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      rateLimitPerMin: r.rateLimitPerMin,
      isRevoked: r.isRevoked,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
