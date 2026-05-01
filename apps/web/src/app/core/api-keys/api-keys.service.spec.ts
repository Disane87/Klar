import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiKeysService,
      ],
    });

    service = TestBed.inject(ApiKeysService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('list makes GET to correct URL', () => {
    let result: unknown;
    service.list('hh-1').subscribe(r => (result = r));
    const req = httpTesting.expectOne('/api/v1/households/hh-1/api-keys');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('create makes POST to correct URL', () => {
    let result: unknown;
    service
      .create('hh-1', { name: 'n8n', scopes: ['transactions:read'] })
      .subscribe(r => (result = r));
    const req = httpTesting.expectOne('/api/v1/households/hh-1/api-keys');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'n8n', scopes: ['transactions:read'] });
    const mockResponse = {
      id: 'key-1',
      name: 'n8n',
      scopes: ['transactions:read'],
      expiresAt: null,
      lastUsedAt: null,
      rateLimitPerMin: 60,
      isRevoked: false,
      createdAt: '2026-01-01',
      fullKey: 'bgb_live_testkey',
    };
    req.flush(mockResponse);
    expect(result).toEqual(mockResponse);
  });

  it('revoke makes PATCH to correct URL', () => {
    let result: unknown;
    service.revoke('hh-1', 'key-1').subscribe(r => (result = r));
    const req = httpTesting.expectOne('/api/v1/households/hh-1/api-keys/key-1/revoke');
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
    expect(result).toBeNull();
  });

  it('delete makes DELETE to correct URL', () => {
    let result: unknown;
    service.delete('hh-1', 'key-1').subscribe(r => (result = r));
    const req = httpTesting.expectOne('/api/v1/households/hh-1/api-keys/key-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(result).toBeNull();
  });
});
