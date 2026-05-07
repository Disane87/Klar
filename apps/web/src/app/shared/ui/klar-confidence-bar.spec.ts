import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { KlarConfidenceBarComponent } from './klar-confidence-bar.component';

@Component({
  standalone: true,
  imports: [KlarConfidenceBarComponent],
  template: `<klar-confidence-bar [value]="v" [showValue]="show" />`,
})
class Host {
  v = 0.9;
  show = true;
}

describe('KlarConfidenceBarComponent', () => {
  function render(v: number, show = true): HTMLElement {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.componentInstance.v = v;
    fix.componentInstance.show = show;
    fix.detectChanges();
    return fix.nativeElement as HTMLElement;
  }

  it('renders the bar fill and percent label', () => {
    const html = render(0.9);
    expect(html.querySelector('div[role="progressbar"]')).toBeTruthy();
    expect(html.textContent).toContain('90');
  });

  it('clamps high/low values into 0..100', () => {
    expect(render(2).textContent).toContain('100');
    expect(render(-1).textContent).toContain('0');
  });

  it('hides percent label when showValue=false', () => {
    const html = render(0.5, false);
    expect(html.textContent?.trim()).toBe('');
  });
});
