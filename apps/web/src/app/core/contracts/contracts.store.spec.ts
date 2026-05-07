import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ContractsStore } from './contracts.store';
import { HouseholdStore } from '../household/household.store';

class StubHouseholdStore {
  activeId = signal<string | null>(null);
}

describe('ContractsStore', () => {
  let store: ContractsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HouseholdStore, useValue: new StubHouseholdStore() },
        ContractsStore,
      ],
    });
    store = TestBed.inject(ContractsStore);
  });

  it('exposes empty buckets when no household is active', () => {
    expect(store.contracts()).toEqual([]);
    expect(store.candidates()).toEqual([]);
    expect(store.detected()).toEqual([]);
    expect(store.confirmed()).toEqual([]);
    expect(store.cancelled()).toEqual([]);
    expect(store.active()).toEqual([]);
  });

  it('toggles status filter and tick on reload', () => {
    store.setStatusFilter('CANDIDATE');
    expect(store.statusFilter()).toBe('CANDIDATE');
    store.setStatusFilter(null);
    expect(store.statusFilter()).toBeNull();
    expect(() => store.reload()).not.toThrow();
  });
});
