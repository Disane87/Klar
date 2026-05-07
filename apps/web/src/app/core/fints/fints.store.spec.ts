import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FintsStore } from './fints.store';
import { HouseholdStore } from '../household/household.store';

class StubHouseholdStore {
  activeId = signal<string | null>(null);
}

describe('FintsStore', () => {
  let store: FintsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HouseholdStore, useValue: new StubHouseholdStore() },
        FintsStore,
      ],
    });
    store = TestBed.inject(FintsStore);
  });

  it('starts empty when no household is active', () => {
    expect(store.connections()).toBeUndefined();
    expect(store.isEmpty()).toBe(true);
    expect(store.hasReauthRequired()).toBe(false);
  });

  it('exposes mutation flag signals defaulting to inactive state', () => {
    expect(store.creating()).toBe(false);
    expect(store.tanSubmitting()).toBe(false);
    expect(store.deleting()).toBeNull();
    expect(store.syncing()).toBeNull();
  });

  it('exposes the active sync run + tan challenge signals as null initially', () => {
    expect(store.activeSyncRunId()).toBeNull();
    expect(store.activeTanChallenge()).toBeNull();
  });

  it('dismissTanFlow clears both transient signals', () => {
    store.activeSyncRunId.set('run-1');
    store.activeTanChallenge.set({ tanReference: 'ref', prompt: 'do it' });
    store.dismissTanFlow();
    expect(store.activeSyncRunId()).toBeNull();
    expect(store.activeTanChallenge()).toBeNull();
  });

  it('rejects mutations when no household is active', async () => {
    await expect(
      store.createConnection({
        bankName: 'X',
        blz: '37050198',
        serverUrl: 'https://x',
        loginName: 'me',
        pin: 'p',
      }),
    ).rejects.toThrow(/No active household/);
    await expect(store.triggerSync('c1')).rejects.toThrow(/No active household/);
    await expect(store.submitTan('r1', '1')).rejects.toThrow(/No active household/);
    await expect(store.deleteConnection('c1')).rejects.toThrow(/No active household/);
  });

  it('reload() does not throw', () => {
    expect(() => store.reload()).not.toThrow();
  });
});
