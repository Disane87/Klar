import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FixedCostsStore } from './fixed-costs.store';
import { HouseholdStore } from '../household/household.store';

class StubHouseholdStore {
  activeId = signal<string | null>(null);
}

describe('FixedCostsStore', () => {
  let store: FixedCostsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HouseholdStore, useValue: new StubHouseholdStore() },
        FixedCostsStore,
      ],
    });
    store = TestBed.inject(FixedCostsStore);
  });

  it('exposes empty buckets when no household is active', () => {
    expect(store.fixedCosts()).toEqual([]);
    expect(store.candidates()).toEqual([]);
    expect(store.detected()).toEqual([]);
    expect(store.confirmed()).toEqual([]);
    expect(store.cancelled()).toEqual([]);
    expect(store.active()).toEqual([]);
    expect(store.contracts()).toEqual([]);
  });

  it('toggles status filter and contractsOnly without throwing', () => {
    store.setStatusFilter('CANDIDATE');
    expect(store.statusFilter()).toBe('CANDIDATE');
    store.setContractsOnly(true);
    expect(store.contractsOnly()).toBe(true);
    store.setStatusFilter(null);
    expect(store.statusFilter()).toBeNull();
    store.setContractsOnly(false);
    expect(store.contractsOnly()).toBe(false);
    expect(() => store.reload()).not.toThrow();
  });
});
