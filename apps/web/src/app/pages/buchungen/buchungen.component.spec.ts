import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuchungenPageComponent } from './buchungen.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { HouseholdStore } from '../../core/household/household.store';

describe('BuchungenPageComponent', () => {
  let dialogOpenSpy: ReturnType<typeof vi.fn>;
  let setAccountIdFilter: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogOpenSpy = vi.fn();
    setAccountIdFilter = vi.fn();
    const transactionsStub = {
      items: signal([]),
      sortedItems: signal([]),
      currentMonth: signal('2026-05'),
      loading: signal(false),
      error: signal(null),
      isEmpty: signal(false),
      reload: vi.fn(),
      setMonth: vi.fn(),
      setAccountIdFilter,
      totalIncomeCents: signal(0),
      totalExpenseCents: signal(0),
      nettoCents: signal(0),
    };

    await TestBed.configureTestingModule({
      imports: [BuchungenPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TransactionsStore, useValue: transactionsStub },
        { provide: CategoriesStore, useValue: { items: signal([]), byId: () => null, loading: signal(false), error: signal(null), reload: vi.fn() } },
        { provide: PageHeaderService, useValue: { set: vi.fn(), stats: signal([]), scopeSegments: signal([]), scopeValue: signal('month') } },
        { provide: KlarDialogService, useValue: { open: dialogOpenSpy, close: vi.fn() } },
        { provide: HouseholdStore, useValue: { activeName: () => 'Test-Haushalt', activeId: signal('h1') } },
      ],
    }).compileComponents();
  });

  it('opens create dialog when openCreate is invoked', () => {
    const fixture = TestBed.createComponent(BuchungenPageComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { openCreate: () => void }).openCreate();
    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buchung anlegen' }),
    );
  });

  it('opens edit dialog when row is clicked via openEdit', () => {
    const fixture = TestBed.createComponent(BuchungenPageComponent);
    fixture.detectChanges();
    const tx = { id: 'abc', amountCents: -100 } as never;
    (fixture.componentInstance as unknown as { openEdit: (t: unknown) => void }).openEdit(tx);
    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buchung bearbeiten', inputs: { tx } }),
    );
  });

  it('clears the account filter on init so the page shows the month view', () => {
    TestBed.createComponent(BuchungenPageComponent).detectChanges();
    expect(setAccountIdFilter).toHaveBeenCalledWith(null);
  });
});
