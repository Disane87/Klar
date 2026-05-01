import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjekteStore } from './projekte.store';
import { OverviewService } from './overview.service';
import { HouseholdStore } from '../household/household.store';

describe('ProjekteStore', () => {
  let store: ProjekteStore;

  beforeEach(() => {
    const householdStoreMock = {
      activeId: signal<string | null>(null),
    };

    const overviewServiceMock = {
      getProjects: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ProjekteStore,
        { provide: HouseholdStore, useValue: householdStoreMock },
        { provide: OverviewService, useValue: overviewServiceMock },
      ],
    });

    store = TestBed.inject(ProjekteStore);
  });

  it('initial statusFilter() is ACTIVE', () => {
    expect(store.statusFilter()).toBe('ACTIVE');
  });

  it('initial isEmpty() is true', () => {
    expect(store.isEmpty()).toBe(true);
  });

  it('setStatusFilter("ALL") updates statusFilter() to "ALL"', () => {
    store.setStatusFilter('ALL');
    expect(store.statusFilter()).toBe('ALL');
  });
});
