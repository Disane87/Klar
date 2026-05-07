import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FintsService } from './fints.service';

describe('FintsService', () => {
  let service: FintsService;
  let httpTesting: HttpTestingController;
  const hh = 'hh-1';
  const base = `/api/v1/households/${hh}/fints`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        FintsService,
      ],
    });
    service = TestBed.inject(FintsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lookupBank GETs the bank lookup endpoint with blz query', () => {
    let body: unknown;
    service.lookupBank(hh, '37050198').subscribe(r => (body = r));
    const req = httpTesting.expectOne(r => r.url === `${base}/banks/lookup`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('blz')).toBe('37050198');
    req.flush({ found: false, allowManualOverride: true });
    expect(body).toEqual({ found: false, allowManualOverride: true });
  });

  it('list GETs /connections', () => {
    service.list(hh).subscribe();
    const req = httpTesting.expectOne(`${base}/connections`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('get GETs /connections/:id', () => {
    service.get(hh, 'c1').subscribe();
    const req = httpTesting.expectOne(`${base}/connections/c1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create POSTs /connections with the body', () => {
    const body = {
      bankName: 'Sparkasse',
      blz: '37050198',
      serverUrl: 'https://x',
      loginName: 'me',
      pin: 'secret',
    };
    service.create(hh, body).subscribe();
    const req = httpTesting.expectOne(`${base}/connections`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('triggerSync POSTs /connections/:id/sync', () => {
    service.triggerSync(hh, 'c1').subscribe();
    const req = httpTesting.expectOne(`${base}/connections/c1/sync`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('submitTan POSTs /sync-runs/:id/tan with the TAN body', () => {
    service.submitTan(hh, 'run-1', '123456').subscribe();
    const req = httpTesting.expectOne(`${base}/sync-runs/run-1/tan`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tan: '123456' });
    req.flush({});
  });

  it('discoveredAccounts GETs /connections/:id/discovered-accounts', () => {
    service.discoveredAccounts(hh, 'c1').subscribe();
    const req = httpTesting.expectOne(`${base}/connections/c1/discovered-accounts`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('attachAccounts POSTs /connections/:id/accounts with the picker payload', () => {
    service.attachAccounts(hh, 'c1', [{ fintsAccountRef: 'A1' }]).subscribe();
    const req = httpTesting.expectOne(`${base}/connections/c1/accounts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ accounts: [{ fintsAccountRef: 'A1' }] });
    req.flush([]);
  });

  it('delete DELETEs /connections/:id', () => {
    service.delete(hh, 'c1').subscribe();
    const req = httpTesting.expectOne(`${base}/connections/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
