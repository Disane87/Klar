import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { KlarHeroComponent } from './klar-hero.component';

@Component({
  standalone: true,
  imports: [KlarHeroComponent],
  template: `
    <klar-hero
      [eyebrow]="eyebrow()"
      [title]="title()"
      [sub]="sub()"
    >
      <button heroActions data-testid="action">Backup</button>
    </klar-hero>
  `,
})
class HostComponent {
  eyebrow = signal<string | null>('Klar Self-Host');
  title   = signal<string>('Alles läuft');
  sub     = signal<string | null>('Postgres 16, OIDC, Backup auf S3.');
}

describe('KlarHeroComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents(),
  );

  it('renders eyebrow, title and sub from inputs', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Klar Self-Host');
    expect(text).toContain('Alles läuft');
    expect(text).toContain('Postgres 16, OIDC, Backup auf S3.');
  });

  it('projects [heroActions] content into the actions slot', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const action = fixture.nativeElement.querySelector('[data-testid="action"]');
    expect(action).not.toBeNull();
    expect(action?.textContent).toContain('Backup');
  });

  it('omits the eyebrow row when input is null', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.eyebrow.set(null);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('Klar Self-Host');
  });

  it('always renders the gradient + glow decor (single canonical look)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const decor = fixture.nativeElement.querySelectorAll('span[aria-hidden="true"]');
    expect(decor.length).toBe(2);
  });

  it('renders the title in the canonical text-[26px] size', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const titleEl: HTMLElement = fixture.nativeElement.querySelector(
      'div[style*="font-display"]',
    );
    expect(titleEl.className).toContain('text-[26px]');
  });
});
