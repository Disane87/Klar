import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionsStore } from './transactions.store';
import { HouseholdStore } from '../household/household.store';

const mockHouseholdStore = { activeId: signal<string | null>(null) };

describe('TransactionsStore', () => {
  let store: TransactionsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        TransactionsStore,
        { provide: HouseholdStore, useValue: mockHouseholdStore },
      ],
    });
    store = TestBed.inject(TransactionsStore);
  });

  describe('initial state', () => {
    it('isEmpty() is true when no items are loaded', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('sortedItems() returns an empty array', () => {
      expect(store.sortedItems()).toEqual([]);
    });

    it('totalIncomeCents() returns 0', () => {
      expect(store.totalIncomeCents()).toBe(0);
    });

    it('totalExpenseCents() returns 0', () => {
      expect(store.totalExpenseCents()).toBe(0);
    });

    it('nettoCents() returns 0', () => {
      expect(store.nettoCents()).toBe(0);
    });
  });

  describe('setMonth()', () => {
    it('updates currentMonth signal to the given value', () => {
      store.setMonth('2026-05');
      expect(store.currentMonth()).toBe('2026-05');
    });
  });

  describe('clearFilters()', () => {
    it('resets categoryFilter and projectFilter to null', () => {
      store.categoryFilter.set('cat-1');
      store.projectFilter.set('proj-1');

      store.clearFilters();

      expect(store.categoryFilter()).toBeNull();
      expect(store.projectFilter()).toBeNull();
    });
  });
});
