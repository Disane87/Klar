import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Component, signal } from '@angular/core';
import { KlarTileComponent, type KlarTileTone } from './klar-tile.component';

@Component({
  standalone: true,
  imports: [KlarTileComponent],
  template: `
    <klar-tile
      [icon]="icon()"
      [label]="label()"
      [value]="value()"
      [sub]="sub()"
      [tone]="tone()"
      [valueClass]="valueClass()"
    />
  `,
})
class HostComponent {
  icon       = signal<string | null>(null);
  label      = signal<string>('Einnahmen');
  value      = signal<string>('1.234,56 €');
  sub        = signal<string | null>(null);
  tone       = signal<KlarTileTone>('neutral');
  valueClass = signal<string>('');
}

describe('KlarTileComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('renders label and value from inputs', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Einnahmen');
    expect(text).toContain('1.234,56 €');
  });

  it('renders the icon when icon input is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.icon.set('pulse');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('klar-icon');
    expect(icon).not.toBeNull();
  });

  it('does not render icon element when icon is null', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.icon.set(null);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('klar-icon');
    expect(icon).toBeNull();
  });

  it('renders the sub line when sub is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.sub.set('0 s Ausfall');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0 s Ausfall');
  });

  it('omits sub wrapper when sub is null', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.sub.set(null);
    fixture.detectChanges();
    // The hidden md:flex span should not be in the DOM when sub is null
    const subSpan = fixture.nativeElement.querySelector('span.hidden') as HTMLElement | null;
    expect(subSpan).toBeNull();
  });

  it('applies success label class when tone="success"', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tone.set('success');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('klar-tile > div') as HTMLElement;
    const labelSpan = tile.querySelector('span') as HTMLElement;
    expect(labelSpan.className).toContain('text-(--success)');
  });

  it('applies danger label class when tone="danger"', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tone.set('danger');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('klar-tile > div') as HTMLElement;
    const labelSpan = tile.querySelector('span') as HTMLElement;
    expect(labelSpan.className).toContain('text-(--danger)');
  });

  it('applies tone-tinted border for success', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tone.set('success');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('klar-tile > div') as HTMLElement;
    expect(tile.className).toContain('border-[oklch(from_var(--success)_l_c_h/0.30)]');
  });

  it('applies tone-tinted border for warn', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tone.set('warn');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('klar-tile > div') as HTMLElement;
    expect(tile.className).toContain('border-[oklch(from_var(--warn)_l_c_h/0.30)]');
  });

  it('applies tone-tinted border for danger', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tone.set('danger');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('klar-tile > div') as HTMLElement;
    expect(tile.className).toContain('border-[oklch(from_var(--danger)_l_c_h/0.30)]');
  });

  it('applies valueClass override to the value wrapper', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.valueClass.set('text-(--success)');
    fixture.detectChanges();
    // Grab the value-wrapper span via children navigation (jsdom can't parse
    // Tailwind 4 arbitrary-value selectors like `bg-(--bg-1)` in a CSS query).
    const host = fixture.nativeElement as HTMLElement;
    const tile = host.firstElementChild!.firstElementChild as HTMLElement;
    const valueSpan = tile.children[1] as HTMLElement;
    expect(valueSpan.className).toContain('text-(--success)');
  });

  it('uses the default text-(--fg) class when no valueClass is provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.valueClass.set('');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const tile = host.firstElementChild!.firstElementChild as HTMLElement;
    const valueSpan = tile.children[1] as HTMLElement;
    expect(valueSpan.className).toContain('text-(--fg)');
  });
});
