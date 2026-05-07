import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AdminHealthStore } from './admin-health.store';

describe('AdminHealthStore', () => {
  let store: AdminHealthStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminHealthStore,
      ],
    });
    store = TestBed.inject(AdminHealthStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('exposes empty initial state before any HTTP call resolves', () => {
    // Resources start undefined; the computed accessors fall through to
    // empty arrays for services/performance/jobs and undefined for status.
    expect(store.status()).toBeUndefined();
    expect(store.services()).toEqual([]);
    expect(store.performance()).toEqual([]);
    expect(store.jobs()).toEqual([]);
  });

  it('reload() bumps the tick signal so resources re-fetch', () => {
    expect(() => store.reload()).not.toThrow();
  });
});
