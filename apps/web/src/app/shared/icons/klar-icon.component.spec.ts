import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { KlarIconComponent } from './klar-icon.component';

describe('KlarIconComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarIconComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  const icons = [
    'fixkosten', 'ueberschuss', 'planspiel', 'haushalt', 'wiederkehrend',
    'dashboard', 'trending', 'folder', 'receipt', 'settings',
    'key', 'shield', 'plus', 'pencil', 'trash',
    'chevron-right', 'chevron-down', 'chevron-left', 'check', 'x', 'alert',
    'wallet', 'card', 'arrow-up-right', 'arrow-down-right', 'refresh',
    'calendar', 'tag', 'search', 'filter', 'eye', 'lock', 'menu', 'logout',
  ];

  it('should create', () => {
    const fixture = TestBed.createComponent(KlarIconComponent);
    fixture.componentRef.setInput('name', 'plus');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders an svg element', () => {
    const fixture = TestBed.createComponent(KlarIconComponent);
    fixture.componentRef.setInput('name', 'plus');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });

  it.each(icons)('renders icon: %s without error', (name) => {
    const fixture = TestBed.createComponent(KlarIconComponent);
    fixture.componentRef.setInput('name', name);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('falls back to alert icon for unknown name', () => {
    const fixture = TestBed.createComponent(KlarIconComponent);
    fixture.componentRef.setInput('name', 'unknown-icon-xyz');
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
