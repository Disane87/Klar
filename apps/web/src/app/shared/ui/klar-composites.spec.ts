import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarActionTileComponent } from './klar-action-tile.component';
import { KlarDateInputComponent } from './klar-date-input.component';
import { KlarDialogFooterComponent } from './klar-dialog-footer.component';
import { KlarSwitchComponent } from './klar-switch.component';

describe('KlarActionTileComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarActionTileComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents(),
  );

  it('renders title and emits action on click', () => {
    const fx = TestBed.createComponent(KlarActionTileComponent);
    fx.componentRef.setInput('title', 'Haushalt beitreten');
    let fired = false;
    fx.componentInstance.action.subscribe(() => (fired = true));
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Haushalt beitreten');
    fx.nativeElement.querySelector('button').click();
    expect(fired).toBe(true);
  });

  it('renders subtitle when given', () => {
    const fx = TestBed.createComponent(KlarActionTileComponent);
    fx.componentRef.setInput('title', 'Foo');
    fx.componentRef.setInput('subtitle', 'Bar baz');
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Bar baz');
  });

  it('does not emit when disabled', () => {
    const fx = TestBed.createComponent(KlarActionTileComponent);
    fx.componentRef.setInput('title', 'Foo');
    fx.componentRef.setInput('disabled', true);
    let fired = false;
    fx.componentInstance.action.subscribe(() => (fired = true));
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(fired).toBe(false);
  });

  it('hides chevron when showChevron=false', () => {
    const fx = TestBed.createComponent(KlarActionTileComponent);
    fx.componentRef.setInput('title', 'Foo');
    fx.componentRef.setInput('showChevron', false);
    fx.detectChanges();
    const icons = fx.nativeElement.querySelectorAll('klar-icon');
    expect(icons.length).toBe(0);
  });

  it('button has touch-target min height', () => {
    const fx = TestBed.createComponent(KlarActionTileComponent);
    fx.componentRef.setInput('title', 'Foo');
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('button').className).toContain('min-h-[56px]');
  });
});

describe('KlarDateInputComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarDateInputComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents(),
  );

  it('renders an input[type=date] with hlmInput', () => {
    const fx = TestBed.createComponent(KlarDateInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.className).toContain('min-h-11');
  });

  it('renders the bound ISO value', () => {
    const fx = TestBed.createComponent(KlarDateInputComponent);
    fx.componentRef.setInput('value', '2026-05-07');
    fx.detectChanges();
    expect((fx.nativeElement.querySelector('input') as HTMLInputElement).value).toBe('2026-05-07');
  });

  it('updates value on input', () => {
    const fx = TestBed.createComponent(KlarDateInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '2026-12-31';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.value()).toBe('2026-12-31');
  });

  it('passes min/max attributes when set', () => {
    const fx = TestBed.createComponent(KlarDateInputComponent);
    fx.componentRef.setInput('min', '2026-01-01');
    fx.componentRef.setInput('max', '2026-12-31');
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('min')).toBe('2026-01-01');
    expect(input.getAttribute('max')).toBe('2026-12-31');
  });
});

describe('KlarDialogFooterComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarDialogFooterComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents(),
  );

  it('shows default Abbrechen / Speichern labels', () => {
    const fx = TestBed.createComponent(KlarDialogFooterComponent);
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Abbrechen');
    expect(fx.nativeElement.textContent).toContain('Speichern');
  });

  it('hides confirm button when showConfirm=false', () => {
    const fx = TestBed.createComponent(KlarDialogFooterComponent);
    fx.componentRef.setInput('showConfirm', false);
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Abbrechen');
    expect(fx.nativeElement.textContent).not.toContain('Speichern');
  });

  it('emits confirm on click', () => {
    const fx = TestBed.createComponent(KlarDialogFooterComponent);
    let fired = false;
    fx.componentInstance.confirm.subscribe(() => (fired = true));
    fx.detectChanges();
    const buttons = fx.nativeElement.querySelectorAll('button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();
    expect(fired).toBe(true);
  });

  it('emits cancel on click', () => {
    const fx = TestBed.createComponent(KlarDialogFooterComponent);
    fx.componentRef.setInput('autoCloseOnCancel', false); // avoid touching dialog service
    let fired = false;
    fx.componentInstance.cancel.subscribe(() => (fired = true));
    fx.detectChanges();
    const buttons = fx.nativeElement.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();
    expect(fired).toBe(true);
  });
});

describe('KlarSwitchComponent', () => {
  @Component({
    standalone: true,
    imports: [KlarSwitchComponent],
    template: `<klar-switch [(checked)]="active" label="Planspiel" description="Geplante Posten." />`,
  })
  class Host {
    active = false;
  }

  it('renders the label and description', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Planspiel');
    expect(fx.nativeElement.textContent).toContain('Geplante Posten.');
  });

  it('contains a hlm-switch', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('hlm-switch')).toBeTruthy();
  });
});
