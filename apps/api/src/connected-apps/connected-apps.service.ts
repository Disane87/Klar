import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { ConnectedApp } from '@prisma/client';
import {
  ConnectedAppsRepository,
  type CreateConnectedAppData,
} from './connected-apps.repository';

const ALLOWED_PROVIDERS = new Set([
  'pocketid',
  'github',
  'google',
  'claude_ai',
  'home_assistant',
  'n8n',
  'zapier',
  'custom',
]);

export interface CreateConnectedAppInput {
  provider: string;
  externalId: string;
  scopes?: string[];
}

export interface UpdateConnectedAppInput {
  scopes?: string[];
}

@Injectable()
export class ConnectedAppsService {
  constructor(private readonly repo: ConnectedAppsRepository) {}

  list(userId: string): Promise<ConnectedApp[]> {
    return this.repo.findAllForUser(userId);
  }

  async create(userId: string, input: CreateConnectedAppInput): Promise<ConnectedApp> {
    if (!input.provider?.trim()) {
      throw new BadRequestException('provider ist erforderlich');
    }
    if (!ALLOWED_PROVIDERS.has(input.provider)) {
      throw new BadRequestException(`provider unbekannt: ${input.provider}`);
    }
    if (!input.externalId?.trim()) {
      throw new BadRequestException('externalId ist erforderlich');
    }

    const data: CreateConnectedAppData = {
      userId,
      provider: input.provider,
      externalId: input.externalId.trim(),
      scopes: input.scopes ?? [],
    };

    try {
      return await this.repo.create(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        throw new ConflictException('Diese Verknüpfung existiert bereits');
      }
      throw err;
    }
  }

  async update(
    userId: string,
    id: string,
    input: UpdateConnectedAppInput,
  ): Promise<ConnectedApp> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundException(`Connected app ${id} nicht gefunden`);
    return this.repo.update(existing.id, userId, {
      scopes: input.scopes,
    });
  }

  async unlink(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundException(`Connected app ${id} nicht gefunden`);
    await this.repo.deleteForUser(existing.id, userId);
  }

  toResponse(c: ConnectedApp) {
    return {
      id: c.id,
      provider: c.provider,
      externalId: c.externalId,
      scopes: c.scopes,
      linkedAt: c.linkedAt.toISOString(),
      lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
    };
  }
}
