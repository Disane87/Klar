import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarMobileHeaderComponent } from './klar-mobile-header.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { OverviewStore } from '../../core/overview/overview.store';

describe('KlarMobileHeaderComponent', () => {
  let pageHeaderStub: Partial<PageHeaderService>;
  let overviewStub: { currentMonth: () => string };

  beforeEach(() => {
    pageHeaderStub = {
      title: signal('Fixkosten') as any,
      chipLabel: signal<string | null>(null) as any,
    };
    overviewStub = { currentMonth: () => '2026-05' };

    TestBed.configureTestingModule({
      imports: [KlarMobileHeaderComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PageHeaderService, useValue: pageHeaderStub },
        { provide: OverviewStore, useValue: overviewStub },
      ],
    }).compileComponents();
  });

  it('renders the page title from PageHeaderService', () => {
    const fixture = TestBed.createComponent(KlarMobileHeaderComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fixkosten');
  });

  it('falls back to the month chip when no chipLabel is set', () => {
    const fixture = TestBed.createComponent(KlarMobileHeaderComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mai 2026');
  });

  it('prefers the explicit chipLabel from PageHeaderService over the month fallback', () => {
    (pageHeaderStub.chipLabel as any).set('Q2 · 2026');
    const fixture = TestBed.createComponent(KlarMobileHeaderComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Q2 · 2026');
    expect(fixture.nativeElement.textContent).not.toContain('Mai 2026');
  });
});
