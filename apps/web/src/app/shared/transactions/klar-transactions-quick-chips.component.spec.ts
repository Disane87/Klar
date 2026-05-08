import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KlarTransactionsQuickChipsComponent } from './klar-transactions-quick-chips.component';
import { EMPTY_FILTERS } from './transaction-filters';

describe('KlarTransactionsQuickChipsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsQuickChipsComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  function findChip(el: HTMLElement, label: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll('button')).find(
      b => (b.textContent ?? '').trim().includes(label),
    ) as HTMLButtonElement;
  }

  it('emits recurring=recurring when "Wiederkehrend" clicked from inactive', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'Wiederkehrend').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, recurring: 'recurring' });
  });

  it('toggles back to recurring=all when "Wiederkehrend" clicked from active', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, recurring: 'recurring' });
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'Wiederkehrend').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, recurring: 'all' });
  });

  it('emits source=fints when "FinTS" clicked', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'FinTS').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, source: 'fints' });
  });

  it('emits amount=income when "Eingänge" clicked', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'Eingänge').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, amount: 'income' });
  });
});
