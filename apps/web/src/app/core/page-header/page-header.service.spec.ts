import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PageHeaderService, type PageHeaderConfig } from './page-header.service';

describe('PageHeaderService', () => {
  let service: PageHeaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), PageHeaderService],
    });
    service = TestBed.inject(PageHeaderService);
  });

  describe('default state', () => {
    it('should have empty title', () => {
      expect(service.title()).toBe('');
    });

    it('should have showAdd false', () => {
      expect(service.showAdd()).toBe(false);
    });

    it('should have showExport false', () => {
      expect(service.showExport()).toBe(false);
    });

    it('should have default addLabel', () => {
      expect(service.addLabel()).toBe('Buchung');
    });

    it('should have empty stats', () => {
      expect(service.stats()).toEqual([]);
    });
  });

  describe('set()', () => {
    it('should set title', () => {
      service.set({ title: 'Fixkosten' });
      expect(service.title()).toBe('Fixkosten');
    });

    it('should set subtitle', () => {
      service.set({ title: 'Test', subtitle: 'Subtitle' });
      expect(service.subtitle()).toBe('Subtitle');
    });

    it('should set showAdd to true', () => {
      service.set({ title: 'Test', showAdd: true });
      expect(service.showAdd()).toBe(true);
    });

    it('should set showExport to true', () => {
      service.set({ title: 'Test', showExport: true });
      expect(service.showExport()).toBe(true);
    });

    it('should set custom addLabel', () => {
      service.set({ title: 'Test', addLabel: 'Neue Buchung' });
      expect(service.addLabel()).toBe('Neue Buchung');
    });

    it('should set callback for onAdd', () => {
      const callback = vi.fn();
      service.set({ title: 'Test', onAdd: callback });
      service.onAdd()?.();
      expect(callback).toHaveBeenCalled();
    });

    it('should clear stats on set', () => {
      service.stats.set([{ label: 'Test', valueCents: 100, tone: 'neutral' }]);
      service.set({ title: 'Test' });
      expect(service.stats()).toEqual([]);
    });

    it('should clear chipLabel on set', () => {
      service.chipLabel.set('May 2026');
      service.set({ title: 'Test' });
      expect(service.chipLabel()).toBeNull();
    });
  });

  describe('updateStats()', () => {
    it('should allow setting stats after set', () => {
      service.set({ title: 'Test' });
      service.stats.set([
        { label: 'Einnahmen', valueCents: 5000, tone: 'income' },
      ]);
      expect(service.stats().length).toBe(1);
    });
  });
});