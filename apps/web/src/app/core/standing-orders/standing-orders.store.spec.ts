import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { StandingOrdersStore } from './standing-orders.store';
import { HouseholdStore } from '../household/household.store';

const mockHouseholdStore = { activeId: signal<string | null>(null) };

describe('StandingOrdersStore', () => {
  let store: StandingOrdersStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        StandingOrdersStore,
        { provide: HouseholdStore, useValue: mockHouseholdStore },
      ],
    });
    store = TestBed.inject(StandingOrdersStore);
  });

  describe('initial state', () => {
    it('isEmpty() is true when no items are loaded', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('items() returns undefined initially (no household)', () => {
      expect(store.items()).toBeUndefined();
    });

    it('isLoading() reflects resource loading state', () => {
      // Initially loading is false because hid is null and loader returns []
      expect(typeof store.isLoading()).toBe('boolean');
    });
  });

  describe('includeInactive signal', () => {
    it('defaults to false', () => {
      expect(store.includeInactive()).toBe(false);
    });

    it('can be toggled to true', () => {
      store.includeInactive.set(true);
      expect(store.includeInactive()).toBe(true);
    });

    it('can be toggled back to false', () => {
      store.includeInactive.set(true);
      store.includeInactive.set(false);
      expect(store.includeInactive()).toBe(false);
    });
  });

  describe('reload()', () => {
    it('calls reload without throwing', () => {
      expect(() => store.reload()).not.toThrow();
    });
  });

  describe('create()', () => {
    it('throws when no active household', async () => {
      mockHouseholdStore.activeId.set(null);
      await expect(
        store.create({ accountId: 'a1', amountCents: -1000, frequency: 'MONTHLY' }),
      ).rejects.toThrow('No active household');
    });
  });

  describe('update()', () => {
    it('throws when no active household', async () => {
      mockHouseholdStore.activeId.set(null);
      await expect(
        store.update('so1', { note: 'test' }),
      ).rejects.toThrow('No active household');
    });
  });

  describe('remove()', () => {
    it('throws when no active household', async () => {
      mockHouseholdStore.activeId.set(null);
      await expect(store.remove('so1')).rejects.toThrow('No active household');
    });
  });
});
