import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Account } from '@prisma/client';
import { AccountsController } from './accounts.controller';
import type { AccountsService } from './accounts.service';
import type { RequestContext } from '../common/types/request-context.type';

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  householdId: 'hh1',
  ownerId: null,
  name: 'Hauptkonto',
  type: 'csv_only',
  currency: 'EUR',
  iban: null,
  bic: null,
  visibility: 'SHARED',
  archivedAt: null,
  fintsConnectionId: null,
  fintsAccountRef: null,
  lastKnownBalanceCents: null,
  lastBalanceAt: null,
  createdAt: new Date('2026-05-07'),
  updatedAt: new Date('2026-05-07'),
  ...overrides,
});

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: {
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    toResponse: ReturnType<typeof vi.fn>;
  };

  const ctx: RequestContext = {
    userId: 'user-1',
    householdId: 'hh1',
    source: 'web',
  };

  beforeEach(() => {
    service = {
      list: vi.fn(),
      update: vi.fn(),
      toResponse: vi.fn((a: Account) => ({ id: a.id, name: a.name })),
    };

    controller = new AccountsController(service as unknown as AccountsService);
  });

  it('is constructed and wires the service (DI smoke)', () => {
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(AccountsController);
  });

  it('GET list returns mapped responses for each account', async () => {
    const accounts = [
      makeAccount({ id: 'a1', name: 'A1' }),
      makeAccount({ id: 'a2', name: 'A2' }),
    ];
    service.list.mockResolvedValue(accounts);

    const result = await controller.list(ctx);

    expect(service.list).toHaveBeenCalledWith('hh1');
    expect(service.toResponse).toHaveBeenCalledTimes(2);
    expect(service.toResponse).toHaveBeenNthCalledWith(1, accounts[0]);
    expect(service.toResponse).toHaveBeenNthCalledWith(2, accounts[1]);
    expect(result).toEqual([
      { id: 'a1', name: 'A1' },
      { id: 'a2', name: 'A2' },
    ]);
  });

  it('PATCH update forwards (ctx, id, body) to service.update and returns mapped response', async () => {
    const updated = makeAccount({ id: 'acc-9', name: 'Renamed' });
    service.update.mockResolvedValue(updated);

    const body = { name: 'Renamed', visibility: 'PRIVATE' as const };
    const result = await controller.update(ctx, 'acc-9', body);

    expect(service.update).toHaveBeenCalledWith(ctx, 'acc-9', body);
    expect(service.toResponse).toHaveBeenCalledWith(updated);
    expect(result).toEqual({ id: 'acc-9', name: 'Renamed' });
  });
});
