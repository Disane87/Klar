import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccountsService, type AccountResponse } from './accounts.service';

describe('AccountsService', () => {
  let svc: AccountsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AccountsService],
    });
    svc = TestBed.inject(AccountsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET list hits the household-scoped endpoint', () => {
    const fixture: AccountResponse[] = [];
    svc.list('hh-1').subscribe((r) => expect(r).toBe(fixture));
    const req = http.expectOne('/api/v1/households/hh-1/accounts');
    expect(req.request.method).toBe('GET');
    req.flush(fixture);
  });

  it('PATCH update sends the patch body to /accounts/:id', () => {
    svc.update('hh-1', 'acc-1', { name: 'Neu', syncEnabled: false }).subscribe();
    const req = http.expectOne('/api/v1/households/hh-1/accounts/acc-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Neu', syncEnabled: false });
    req.flush({});
  });
});
