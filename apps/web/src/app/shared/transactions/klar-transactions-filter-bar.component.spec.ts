import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KlarTransactionsFilterBarComponent } from './klar-transactions-filter-bar.component';
import { EMPTY_FILTERS } from './transaction-filters';

describe('KlarTransactionsFilterBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsFilterBarComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  function build(lockedKeys: readonly string[] = []) {
    const fixture = TestBed.createComponent(KlarTransactionsFilterBarComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    fixture.componentRef.setInput('lockedKeys', lockedKeys);
    fixture.componentRef.setInput('accountOptions', [
      { value: 'acc1', label: 'Giro' },
      { value: 'acc2', label: 'Spar' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  it('emits filters with new search on input', () => {
    const fixture = build();
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'edeka';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: 'edeka' });
  });

  it('emits reset signal on reset click', () => {
    const fixture = TestBed.createComponent(KlarTransactionsFilterBarComponent);
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, search: 'foo' });
    fixture.componentRef.setInput('lockedKeys', []);
    fixture.componentRef.setInput('accountOptions', []);
    fixture.componentRef.setInput('showReset', true);
    const spy = vi.fn();
    fixture.componentInstance.resetClick.subscribe(spy);
    fixture.detectChanges();
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => ((b as HTMLButtonElement).textContent ?? '').includes('Filter zurücksetzen'),
    ) as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('marks the locked accountId pill with data-locked="true"', () => {
    const fixture = TestBed.createComponent(KlarTransactionsFilterBarComponent);
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, accountId: 'acc1' });
    fixture.componentRef.setInput('lockedKeys', ['accountId']);
    fixture.componentRef.setInput('accountOptions', [{ value: 'acc1', label: 'Giro' }]);
    fixture.detectChanges();
    const accountSelect = fixture.nativeElement.querySelector('[data-filter="accountId"]');
    expect(accountSelect?.getAttribute('data-locked')).toBe('true');
  });
});
