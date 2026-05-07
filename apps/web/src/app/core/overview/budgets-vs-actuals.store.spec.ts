import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BudgetVsActualsStore } from './budgets-vs-actuals.store';
import { HouseholdStore } from '../household/household.store';

class StubHouseholdStore {
  activeId = signal<string | null>(null);
}

describe('BudgetVsActualsStore', () => {
  let store: BudgetVsActualsStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HouseholdStore, useValue: new StubHouseholdStore() },
        BudgetVsActualsStore,
      ],
    });
    store = TestBed.inject(BudgetVsActualsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts empty when no household is active', () => {
    expect(store.rows()).toEqual([]);
  });

  it('setMonth updates the month signal + reload does not throw', () => {
    expect(() => store.setMonth('2026-01')).not.toThrow();
    expect(() => store.reload()).not.toThrow();
  });
});
