import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HlmSwitchComponent } from './hlm-switch.component';
import { HlmTabsImports } from './hlm-tabs';
import { HlmTooltipDirective } from './hlm-tooltip.directive';
import { HlmSeparatorDirective } from './hlm-separator.directive';
import { HlmAlertDialogImports } from './hlm-alert-dialog';
import { HlmSheetImports } from './hlm-sheet';

describe('HlmSwitchComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HlmSwitchComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents(),
  );

  it('creates', () => {
    const fx = TestBed.createComponent(HlmSwitchComponent);
    expect(fx.componentInstance).toBeTruthy();
  });

  it('renders brn-switch with thumb', () => {
    const fx = TestBed.createComponent(HlmSwitchComponent);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('brn-switch')).toBeTruthy();
    expect(fx.nativeElement.querySelector('brn-switch-thumb')).toBeTruthy();
  });

  it('reflects checked input two-way', () => {
    const fx = TestBed.createComponent(HlmSwitchComponent);
    fx.componentRef.setInput('checked', true);
    fx.detectChanges();
    expect(fx.componentInstance.checked()).toBe(true);
  });

  it('passes ariaLabel through', () => {
    const fx = TestBed.createComponent(HlmSwitchComponent);
    fx.componentRef.setInput('ariaLabel', 'Toggle dark mode');
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('button');
    expect(btn?.getAttribute('aria-label')).toBe('Toggle dark mode');
  });

  it('has focus-visible ring class for a11y', () => {
    const fx = TestBed.createComponent(HlmSwitchComponent);
    fx.detectChanges();
    expect(fx.componentInstance['_btnCls']()).toContain('focus-visible:ring-2');
  });
});

describe('HlmSeparatorDirective', () => {
  @Component({
    standalone: true,
    imports: [HlmSeparatorDirective],
    template: `<div hlmSeparator></div><div hlmSeparator orientation="vertical"></div>`,
  })
  class Host {}

  it('renders horizontal by default', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const divs = fx.nativeElement.querySelectorAll('div');
    expect(divs[0].className).toContain('h-px');
    expect(divs[0].className).toContain('w-full');
  });

  it('renders vertical when orientation=vertical', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const divs = fx.nativeElement.querySelectorAll('div');
    expect(divs[1].className).toContain('w-px');
  });
});

describe('HlmTabsImports', () => {
  @Component({
    standalone: true,
    imports: [...HlmTabsImports],
    template: `
      <div [hlmTabs]="active">
        <div hlmTabsList>
          <button hlmTabsTrigger="a">A</button>
          <button hlmTabsTrigger="b">B</button>
        </div>
        <div hlmTabsContent="a">Content A</div>
        <div hlmTabsContent="b">Content B</div>
      </div>
    `,
  })
  class Host {
    active = 'a';
  }

  it('renders tablist + triggers + content', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[role="tablist"]')).toBeTruthy();
    expect(fx.nativeElement.querySelectorAll('button[hlmTabsTrigger]').length).toBe(2);
  });

  it('triggers have type=button (not submit)', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const btns = fx.nativeElement.querySelectorAll('button[hlmTabsTrigger]');
    btns.forEach((b: HTMLButtonElement) => expect(b.type).toBe('button'));
  });

  it('trigger has min-h 44px (mobile touch target)', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('button[hlmTabsTrigger]');
    expect(btn.className).toContain('min-h-[44px]');
  });
});

describe('HlmTooltipDirective', () => {
  @Component({
    standalone: true,
    imports: [HlmTooltipDirective],
    template: `<button hlmTooltip="Kopieren" position="top">x</button>`,
  })
  class Host {}

  it('attaches without throwing', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fx = TestBed.createComponent(Host);
    expect(() => fx.detectChanges()).not.toThrow();
    expect(fx.nativeElement.querySelector('button')).toBeTruthy();
  });
});

describe('HlmAlertDialogImports', () => {
  it('exports the expected pieces', () => {
    expect(HlmAlertDialogImports.length).toBeGreaterThanOrEqual(6);
  });
});

describe('HlmSheetImports', () => {
  it('exports the expected pieces', () => {
    expect(HlmSheetImports.length).toBeGreaterThanOrEqual(7);
  });
});
