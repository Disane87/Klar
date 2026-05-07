import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { KlarMetricTileComponent } from './klar-metric-tile.component';

@Component({
  standalone: true,
  imports: [KlarMetricTileComponent],
  template: `
    <klar-metric-tile [label]="lbl" [value]="val" [sub]="sub" [accent]="accent" />
  `,
})
class Host {
  lbl = 'Einnahmen';
  val = '1.234,56';
  sub = '+ 1,2 %';
  accent = false;
}

describe('KlarMetricTileComponent', () => {
  it('renders the label, value and sub line', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.detectChanges();
    const html = fix.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Einnahmen');
    expect(html.textContent).toContain('1.234,56');
    expect(html.textContent).toContain('+ 1,2 %');
  });

  it('switches the value tint when accent is enabled', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.componentInstance.accent = true;
    fix.detectChanges();
    const tile = fix.nativeElement.querySelector('div') as HTMLElement;
    expect(tile.className).toMatch(/--success/);
  });
});
