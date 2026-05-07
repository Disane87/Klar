import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarBottomNavComponent } from './klar-bottom-nav.component';

describe('KlarBottomNavComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarBottomNavComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents()
  );

  it('renders the four bundle-spec mobile tabs', () => {
    const fixture = TestBed.createComponent(KlarBottomNavComponent);
    fixture.detectChanges();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('a span'),
    ).map((el: any) => (el.textContent ?? '').trim());
    expect(labels).toEqual(['Fixkosten', 'Cashflow', 'Projekte', 'Mehr']);
  });

  it('routes each tab to the expected /app path', () => {
    const fixture = TestBed.createComponent(KlarBottomNavComponent);
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    ).map((el: any) => el.getAttribute('href') ?? el.getAttribute('ng-reflect-router-link'));
    expect(links).toEqual([
      '/app/fixkosten',
      '/app/monat',
      '/app/projekte',
      '/app/mehr',
    ]);
  });

  it('applies the bundle layout host classes (fixed bottom + safe-area + 60px)', () => {
    const fixture = TestBed.createComponent(KlarBottomNavComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const cls = host.className;
    expect(cls).toContain('fixed');
    expect(cls).toContain('bottom-0');
    expect(cls).toContain('h-(--bottomnav-h)');
    expect(cls).toContain('pb-(--safe-bottom)');
    expect(cls).toContain('md:hidden');
  });
});
