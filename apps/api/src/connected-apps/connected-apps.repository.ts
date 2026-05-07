import { Injectable } from '@nestjs/common';
import type { ConnectedApp } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateConnectedAppData {
  userId: string;
  provider: string;
  externalId: string;
  scopes?: string[];
}

export interface UpdateConnectedAppData {
  scopes?: string[];
  lastUsedAt?: Date;
}

@Injectable()
export class ConnectedAppsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<ConnectedApp[]> {
    return this.prisma.connectedApp.findMany({
      where: { userId },
      orderBy: { linkedAt: 'desc' },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<ConnectedApp | null> {
    return this.prisma.connectedApp.findFirst({ where: { id, userId } });
  }

  create(data: CreateConnectedAppData): Promise<ConnectedApp> {
    return this.prisma.connectedApp.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        externalId: data.externalId,
        scopes: data.scopes ?? [],
      },
    });
  }

  update(id: string, userId: string, data: UpdateConnectedAppData): Promise<ConnectedApp> {
    return this.prisma.connectedApp.update({
      where: { id, userId } as unknown as { id: string },
      data,
    });
  }

  async deleteForUser(id: string, userId: string): Promise<void> {
    await this.prisma.connectedApp.deleteMany({ where: { id, userId } });
  }
}
