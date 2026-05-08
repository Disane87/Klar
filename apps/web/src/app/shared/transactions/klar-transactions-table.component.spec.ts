import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KlarTransactionsTableComponent } from './klar-transactions-table.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import type { Transaction } from '../../core/transactions/transactions.store';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'id-' + Math.random(), householdId: 'h', categoryId: 'c1', projectId: null,
    recurringTransactionId: null, amountCents: -100, plannedAmountCents: null,
    isPlanned: false, description: 'x', counterparty: null,
    date: '2026-05-04', visibility: 'SHARED', color: null, icon: null,
    createdAt: '2026-05-04T10:00:00Z', source: 'manual',
    bankFieldsLockedAt: null, fintsSyncRunId: null, ...overrides,
  } as Transaction;
}

describe('KlarTransactionsTableComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsTableComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CategoriesStore, useValue: { byId: () => null, items: () => [] } },
      ],
    });
  });

  it('locked filters from input are merged into initial state', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', [
      tx({ id: 'a', accountId: 'acc1' }),
      tx({ id: 'b', accountId: 'acc2' }),
    ]);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    expect(fixture.componentInstance.visibleTransactions().map(t => t.id)).toEqual(['a']);
  });

  it('reset does not clear locked filters', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', [
      tx({ id: 'a', accountId: 'acc1', counterparty: 'Edeka' }),
      tx({ id: 'b', accountId: 'acc1', counterparty: 'Aldi' }),
    ]);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    fixture.componentInstance.onFiltersChange({
      ...fixture.componentInstance.filters(),
      search: 'Edeka',
    });
    fixture.componentInstance.onReset();
    expect(fixture.componentInstance.filters().accountId).toBe('acc1');
    expect(fixture.componentInstance.filters().search).toBe('');
  });

  it('isFiltered() returns false initially with locked filters set', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', []);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    expect(fixture.componentInstance.isFiltered()).toBe(false);
  });

  it('isFiltered() returns true after a user filter changes', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', []);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    fixture.componentInstance.onFiltersChange({
      ...fixture.componentInstance.filters(),
      search: 'edeka',
    });
    expect(fixture.componentInstance.isFiltered()).toBe(true);
  });

  it('forwards rowClick from row to its own output', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    const t = tx({ id: 'abc' });
    fixture.componentRef.setInput('transactions', [t]);
    const spy = vi.fn();
    fixture.componentInstance.rowClick.subscribe(spy);
    fixture.detectChanges();
    fixture.componentInstance.onRowClick(t);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }));
  });
});
