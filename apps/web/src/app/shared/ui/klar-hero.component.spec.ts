import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Component, signal } from '@angular/core';
import { KlarHeroComponent, type KlarHeroVariant } from './klar-hero.component';

@Component({
  standalone: true,
  imports: [KlarHeroComponent],
  template: `
    <klar-hero
      [variant]="variant()"
      [eyebrow]="eyebrow()"
      [title]="title()"
      [sub]="sub()"
    >
      <button heroActions data-testid="action">Backup</button>
    </klar-hero>
  `,
})
class HostComponent {
  variant = signal<KlarHeroVariant>('admin');
  eyebrow = signal<string | null>('Klar Self-Host');
  title   = signal<string>('Alles läuft');
  sub     = signal<string | null>('Postgres 16, OIDC, Backup auf S3.');
}

describe('KlarHeroComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
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

  it('renders the gradient + glow decor for admin and vert variants only', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const setVariant = (v: KlarHeroVariant) => {
      fixture.componentInstance.variant.set(v);
      fixture.detectChanges();
    };
    const decorCount = () =>
      fixture.nativeElement.querySelectorAll('[aria-hidden="true"]').length;

    setVariant('admin');
    expect(decorCount()).toBe(2);

    setVariant('vert');
    expect(decorCount()).toBe(2);

    setVariant('haushalt');
    expect(decorCount()).toBe(0);

    setVariant('profile');
    expect(decorCount()).toBe(0);
  });

  it('applies the bundle-spec title size per variant', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const titleEl = (): HTMLElement =>
      fixture.nativeElement.querySelector('div[style*="font-display"]');

    fixture.componentInstance.variant.set('admin');
    fixture.detectChanges();
    expect(titleEl().className).toContain('text-[26px]');

    fixture.componentInstance.variant.set('haushalt');
    fixture.detectChanges();
    expect(titleEl().className).toContain('text-[32px]');

    fixture.componentInstance.variant.set('vert');
    fixture.detectChanges();
    expect(titleEl().className).toContain('text-[22px]');
  });
});
