import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KlarTransactionsRowComponent } from './klar-transactions-row.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import type { Transaction } from '../../core/transactions/transactions.store';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'id', householdId: 'h', categoryId: 'c1', projectId: null,
    recurringTransactionId: null, amountCents: -1234, plannedAmountCents: null,
    isPlanned: false, description: 'Test', counterparty: 'Edeka',
    date: '2026-05-04', visibility: 'SHARED', color: null, icon: null,
    createdAt: '2026-05-04T10:00:00Z', source: 'manual',
    bankFieldsLockedAt: null, fintsSyncRunId: null, ...overrides,
  };
}

describe('KlarTransactionsRowComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsRowComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CategoriesStore, useValue: { byId: () => null } },
      ],
    });
  });

  it('renders the counterparty as primary label, falling back to description', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    fixture.componentRef.setInput('tx', tx({ counterparty: 'Edeka', description: 'Other' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Edeka');
  });

  it('emits rowClick on click', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    const spy = vi.fn();
    fixture.componentRef.setInput('tx', tx({ id: 'abc' }));
    fixture.componentInstance.rowClick.subscribe(spy);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="button"]').click();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }));
  });

  it('shows recurring chip when recurringTransactionId is set', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    fixture.componentRef.setInput('tx', tx({ recurringTransactionId: 'r1' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('wiederkehrend');
  });

  it('shows FinTS badge when source is fints', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    fixture.componentRef.setInput('tx', tx({ source: 'fints' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('FinTS');
  });
});
