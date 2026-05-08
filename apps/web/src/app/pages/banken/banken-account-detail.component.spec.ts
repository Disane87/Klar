import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BankenAccountDetailComponent } from './banken-account-detail.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { HouseholdStore } from '../../core/household/household.store';
import { FintsStore } from '../../core/fints/fints.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

describe('BankenAccountDetailComponent', () => {
  let setAccountIdFilter: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let triggerSync: ReturnType<typeof vi.fn>;
  let dialogOpenSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setAccountIdFilter = vi.fn();
    reload = vi.fn();
    triggerSync = vi.fn().mockResolvedValue(undefined);
    dialogOpenSpy = vi.fn();

    const paramMap = new Map<string, string>([['connectionId', 'conn1'], ['accountId', 'acc1']]);

    await TestBed.configureTestingModule({
      imports: [BankenAccountDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (k: string) => paramMap.get(k) ?? null,
              },
            },
          },
        },
        {
          provide: TransactionsStore,
          useValue: {
            items: signal([]),
            sortedItems: signal([]),
            loading: signal(false),
            error: signal(null),
            isEmpty: signal(true),
            setAccountIdFilter,
            reload,
            currentMonth: signal('2026-05'),
          },
        },
        { provide: CategoriesStore, useValue: { byId: () => null, items: signal([]) } },
        { provide: HouseholdStore, useValue: { activeId: signal('h1') } },
        {
          provide: FintsStore,
          useValue: {
            connections: signal([
              {
                id: 'conn1',
                bankName: 'Sparkasse',
                lastSyncAt: '2026-05-08T10:00:00Z',
                accounts: [{ id: 'acc1', name: 'Giro', iban: 'DE…', lastKnownBalanceCents: 12345 }],
              },
            ]),
            syncing: signal(null),
            reload: vi.fn(),
            triggerSync,
          },
        },
        { provide: PageHeaderService, useValue: { set: vi.fn() } },
        { provide: KlarDialogService, useValue: { open: dialogOpenSpy, close: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('sets accountIdFilter on init from route param', () => {
    const fixture = TestBed.createComponent(BankenAccountDetailComponent);
    fixture.detectChanges();
    expect(setAccountIdFilter).toHaveBeenCalledWith('acc1');
  });

  it('triggers store.reload after sync', async () => {
    const fixture = TestBed.createComponent(BankenAccountDetailComponent);
    fixture.detectChanges();
    await (fixture.componentInstance as unknown as { onSync: () => Promise<void> }).onSync();
    expect(triggerSync).toHaveBeenCalledWith('conn1');
    expect(reload).toHaveBeenCalled();
  });

  it('opens create dialog with presetAccountId set when openCreate runs', () => {
    const fixture = TestBed.createComponent(BankenAccountDetailComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { openCreate: () => void }).openCreate();
    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: expect.objectContaining({ presetAccountId: 'acc1' }),
      }),
    );
  });
});
