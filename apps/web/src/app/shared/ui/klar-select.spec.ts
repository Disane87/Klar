import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarSelectComponent, type KlarSelectOption } from './klar-select.component';

describe('KlarSelectComponent', () => {
  @Component({
    standalone: true,
    imports: [KlarSelectComponent],
    template: `
      <klar-select [(value)]="freq" placeholder="Häufigkeit" [options]="opts" />
    `,
  })
  class Host {
    freq = '';
    opts: KlarSelectOption[] = [
      { value: 'WEEKLY', label: 'Wöchentlich' },
      { value: 'MONTHLY', label: 'Monatlich' },
    ];
  }

  function setup(over: Partial<Host> = {}) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    const fx = TestBed.createComponent(Host);
    Object.assign(fx.componentInstance, over);
    fx.detectChanges();
    return fx;
  }

  it('renders a brn-select with a button trigger', () => {
    const fx = setup();
    expect(fx.nativeElement.querySelector('brn-select')).toBeTruthy();
    const trigger = fx.nativeElement.querySelector('button[brnSelectTrigger]');
    expect(trigger).toBeTruthy();
    expect(trigger.type).toBe('button');
  });

  it('trigger has 16px font size (iOS no-zoom rule)', () => {
    const fx = setup();
    const trigger = fx.nativeElement.querySelector('button[brnSelectTrigger]') as HTMLElement;
    expect(trigger.className).toContain('text-[1rem]');
  });

  it('aria-label falls back to placeholder', () => {
    const fx = setup();
    const trigger = fx.nativeElement.querySelector('button[brnSelectTrigger]') as HTMLElement;
    expect(trigger.getAttribute('aria-label')).toBe('Häufigkeit');
  });

  it('writeValue + registerOnChange round-trip', () => {
    const fx = setup();
    const cmp = fx.debugElement.query((d) => d.componentInstance instanceof KlarSelectComponent)!
      .componentInstance as KlarSelectComponent;
    cmp.writeValue('WEEKLY');
    expect(cmp.value()).toBe('WEEKLY');
    let captured: string | '' = '';
    cmp.registerOnChange((v) => (captured = v));
    cmp.onChange('MONTHLY');
    expect(captured).toBe('MONTHLY');
    expect(cmp.value()).toBe('MONTHLY');
  });

  it('writeValue handles null/undefined as empty string', () => {
    const fx = setup();
    const cmp = fx.debugElement.query((d) => d.componentInstance instanceof KlarSelectComponent)!
      .componentInstance as KlarSelectComponent;
    cmp.writeValue(null);
    expect(cmp.value()).toBe('');
    cmp.writeValue(undefined);
    expect(cmp.value()).toBe('');
  });
});
