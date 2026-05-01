import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanspielStore } from './planspiel.store';

const baseEntry = {
  label: 'Gehalt',
  amountCents: 300000,
  frequency: 'MONTHLY' as const,
  color: '#22c55e',
};

describe('PlanspielStore', () => {
  let store: PlanspielStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PlanspielStore,
      ],
    });
    store = TestBed.inject(PlanspielStore);
  });

  describe('initial state', () => {
    it('isEmpty() returns true when no entries exist', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('result().surplusCents is 0 when no entries exist', () => {
      expect(store.result().surplusCents).toBe(0);
    });
  });

  describe('addEntry()', () => {
    it('adds an entry with an auto-generated non-empty string id', () => {
      store.addEntry(baseEntry);
      const entries = store.entries();
      expect(entries).toHaveLength(1);
      expect(typeof entries[0].id).toBe('string');
      expect(entries[0].id.length).toBeGreaterThan(0);
    });

    it('sets isEmpty() to false after adding an entry', () => {
      store.addEntry(baseEntry);
      expect(store.isEmpty()).toBe(false);
    });

    it('preserves all provided fields on the added entry', () => {
      store.addEntry(baseEntry);
      const entry = store.entries()[0];
      expect(entry.label).toBe(baseEntry.label);
      expect(entry.amountCents).toBe(baseEntry.amountCents);
      expect(entry.frequency).toBe(baseEntry.frequency);
      expect(entry.color).toBe(baseEntry.color);
    });

    it('generates distinct ids for multiple entries', () => {
      store.addEntry(baseEntry);
      store.addEntry({ ...baseEntry, label: 'Miete', amountCents: -80000 });
      const [a, b] = store.entries();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('removeEntry()', () => {
    it('removes the entry by id, making isEmpty() true again', () => {
      store.addEntry(baseEntry);
      const id = store.entries()[0].id;
      store.removeEntry(id);
      expect(store.isEmpty()).toBe(true);
    });

    it('only removes the targeted entry when multiple exist', () => {
      store.addEntry(baseEntry);
      store.addEntry({ ...baseEntry, label: 'Nebenjob', amountCents: 50000 });
      const idToRemove = store.entries()[0].id;
      store.removeEntry(idToRemove);
      expect(store.entries()).toHaveLength(1);
      expect(store.entries()[0].id).not.toBe(idToRemove);
    });
  });

  describe('updateEntry()', () => {
    it('patches only the specified field, leaving others unchanged', () => {
      store.addEntry(baseEntry);
      const id = store.entries()[0].id;
      store.updateEntry(id, { amountCents: 350000 });
      const updated = store.entries()[0];
      expect(updated.amountCents).toBe(350000);
      expect(updated.label).toBe(baseEntry.label);
      expect(updated.frequency).toBe(baseEntry.frequency);
      expect(updated.color).toBe(baseEntry.color);
      expect(updated.id).toBe(id);
    });

    it('can patch multiple fields at once', () => {
      store.addEntry(baseEntry);
      const id = store.entries()[0].id;
      store.updateEntry(id, { label: 'Gehalt neu', color: '#ef4444' });
      const updated = store.entries()[0];
      expect(updated.label).toBe('Gehalt neu');
      expect(updated.color).toBe('#ef4444');
      expect(updated.amountCents).toBe(baseEntry.amountCents);
    });

    it('does not affect other entries', () => {
      store.addEntry(baseEntry);
      store.addEntry({ ...baseEntry, label: 'Miete', amountCents: -80000 });
      const idFirst = store.entries()[0].id;
      store.updateEntry(idFirst, { amountCents: 999 });
      expect(store.entries()[1].amountCents).toBe(-80000);
    });
  });

  describe('reset()', () => {
    it('clears all entries, making isEmpty() true', () => {
      store.addEntry(baseEntry);
      store.addEntry({ ...baseEntry, label: 'Miete', amountCents: -80000 });
      store.reset();
      expect(store.entries()).toHaveLength(0);
      expect(store.isEmpty()).toBe(true);
    });
  });

  describe('surplusPositive()', () => {
    it('returns true when income entry produces a positive surplus', () => {
      store.addEntry({ ...baseEntry, amountCents: 300000 }); // income
      expect(store.surplusPositive()).toBe(true);
    });

    it('returns false when expenses exceed income', () => {
      store.addEntry({ ...baseEntry, label: 'Gehalt', amountCents: 100000 }); // income
      store.addEntry({ ...baseEntry, label: 'Ausgabe', amountCents: -200000, color: '#ef4444' }); // expense
      expect(store.surplusPositive()).toBe(false);
    });

    it('returns true when surplus is exactly 0', () => {
      store.addEntry({ ...baseEntry, label: 'Einnahme', amountCents: 100000 });
      store.addEntry({ ...baseEntry, label: 'Ausgabe', amountCents: -100000, color: '#ef4444' });
      expect(store.surplusPositive()).toBe(true);
    });
  });

  describe('result()', () => {
    it('reflects a single monthly income entry correctly', () => {
      store.addEntry({ ...baseEntry, amountCents: 300000 });
      const result = store.result();
      expect(result.recurringIncomeCents).toBe(300000);
      expect(result.recurringExpensesCents).toBe(0);
      expect(result.surplusCents).toBe(300000);
    });

    it('reflects a single monthly expense entry correctly', () => {
      store.addEntry({ ...baseEntry, amountCents: -80000, color: '#ef4444' });
      const result = store.result();
      expect(result.recurringExpensesCents).toBe(80000);
      expect(result.recurringIncomeCents).toBe(0);
      expect(result.surplusCents).toBe(-80000);
    });

    it('sums multiple entries and returns the correct surplus', () => {
      store.addEntry({ ...baseEntry, label: 'Gehalt', amountCents: 300000 });
      store.addEntry({ ...baseEntry, label: 'Miete', amountCents: -100000, color: '#ef4444' });
      store.addEntry({ ...baseEntry, label: 'Strom', amountCents: -20000, color: '#f97316' });
      const result = store.result();
      expect(result.recurringIncomeCents).toBe(300000);
      expect(result.recurringExpensesCents).toBe(120000);
      expect(result.surplusCents).toBe(180000);
    });

    it('applies toMonthlyEquivalent for a YEARLY entry', () => {
      store.addEntry({ ...baseEntry, amountCents: 120000, frequency: 'YEARLY' as const });
      const result = store.result();
      // 120000 / 12 = 10000
      expect(result.recurringIncomeCents).toBe(10000);
    });

    it('applies toMonthlyEquivalent for a QUARTERLY entry', () => {
      store.addEntry({ ...baseEntry, amountCents: -30000, frequency: 'QUARTERLY' as const, color: '#ef4444' });
      const result = store.result();
      // 30000 / 3 = 10000
      expect(result.recurringExpensesCents).toBe(10000);
    });
  });
});
