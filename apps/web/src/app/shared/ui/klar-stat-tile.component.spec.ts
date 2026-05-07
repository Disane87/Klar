import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Component, signal } from '@angular/core';
import {
  KlarStatTileComponent,
  type KlarStatTileTone,
} from './klar-stat-tile.component';

@Component({
  standalone: true,
  imports: [KlarStatTileComponent],
  template: `
    <klar-stat-tile
      [icon]="icon()"
      [label]="label()"
      [value]="value()"
      [delta]="delta()"
      [tone]="tone()"
    />
  `,
})
class HostComponent {
  icon  = signal<string | null>('pulse');
  label = signal<string>('Uptime · 30 T');
  value = signal<string>('99,98 %');
  delta = signal<string | null>('0 s Ausfall');
  tone  = signal<KlarStatTileTone>('neutral');
}

describe('KlarStatTileComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('renders the label, value and delta from inputs', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Uptime · 30 T');
    expect(text).toContain('99,98 %');
    expect(text).toContain('0 s Ausfall');
  });

  it('omits the delta line when no delta is provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.delta.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('0 s Ausfall');
  });

  it('renders the bundle-spec border tone for ok / warn / danger', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const tile = (): HTMLElement =>
      fixture.nativeElement.querySelector('klar-stat-tile > div');

    fixture.componentInstance.tone.set('ok');
    fixture.detectChanges();
    expect(tile().className).toContain('border-[oklch(from_var(--success)_l_c_h/0.30)]');

    fixture.componentInstance.tone.set('warn');
    fixture.detectChanges();
    expect(tile().className).toContain('border-[oklch(from_var(--warn)_l_c_h/0.30)]');

    fixture.componentInstance.tone.set('danger');
    fixture.detectChanges();
    expect(tile().className).toContain('border-[oklch(from_var(--danger)_l_c_h/0.30)]');
  });

  it('uses tabular-nums and the display font for the headline value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const valueEl = fixture.nativeElement.querySelector('span.text-\\[24px\\]') as HTMLElement;
    expect(valueEl).not.toBeNull();
    expect(valueEl.className).toContain('[font-variant-numeric:tabular-nums]');
    expect(valueEl.className).toContain('[font-family:var(--font-display)]');
  });
});
