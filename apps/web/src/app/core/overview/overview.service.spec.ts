import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OverviewService } from './overview.service';

describe('OverviewService', () => {
  let service: OverviewService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        OverviewService,
      ],
    });
    service = TestBed.inject(OverviewService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  describe('getFixedCosts', () => {
    it('GETs /overview/fixed-costs without params', () => {
      let result: unknown;
      service.getFixedCosts('hh-1').subscribe(r => (result = r));
      const req = httpTesting.expectOne('/api/v1/households/hh-1/overview/fixed-costs');
      expect(req.request.method).toBe('GET');
      req.flush({ month: '2026-04', totalCents: 0, groups: [] });
      expect((result as { totalCents: number }).totalCents).toBe(0);
    });

    it('passes month as query param when provided', () => {
      service.getFixedCosts('hh-1', '2026-04').subscribe();
      const req = httpTesting.expectOne(
        '/api/v1/households/hh-1/overview/fixed-costs?month=2026-04',
      );
      expect(req.request.params.get('month')).toBe('2026-04');
      req.flush({ month: '2026-04', totalCents: 0, groups: [] });
    });
  });

  describe('getCashflow', () => {
    it('GETs /overview/cashflow without params', () => {
      service.getCashflow('hh-1').subscribe();
      const req = httpTesting.expectOne('/api/v1/households/hh-1/overview/cashflow');
      expect(req.request.method).toBe('GET');
      req.flush({ month: '2026-04', surplusCents: 0 });
    });

    it('passes month as query param when provided', () => {
      service.getCashflow('hh-1', '2026-05').subscribe();
      const req = httpTesting.expectOne(
        '/api/v1/households/hh-1/overview/cashflow?month=2026-05',
      );
      expect(req.request.params.get('month')).toBe('2026-05');
      req.flush({ month: '2026-05', surplusCents: 100000 });
    });
  });

  describe('getProjects', () => {
    it('GETs /overview/projects without params', () => {
      let result: unknown;
      service.getProjects('hh-1').subscribe(r => (result = r));
      const req = httpTesting.expectOne('/api/v1/households/hh-1/overview/projects');
      expect(req.request.method).toBe('GET');
      req.flush({ projects: [] });
      expect((result as { projects: unknown[] }).projects).toEqual([]);
    });

    it('passes status as query param when provided', () => {
      service.getProjects('hh-1', 'ACTIVE').subscribe();
      const req = httpTesting.expectOne(
        '/api/v1/households/hh-1/overview/projects?status=ACTIVE',
      );
      expect(req.request.params.get('status')).toBe('ACTIVE');
      req.flush({ projects: [] });
    });

    it('does not include status param when not provided', () => {
      service.getProjects('hh-1').subscribe();
      const req = httpTesting.expectOne('/api/v1/households/hh-1/overview/projects');
      expect(req.request.params.has('status')).toBe(false);
      req.flush({ projects: [] });
    });
  });
});
