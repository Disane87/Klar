import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { KlarProgressRingComponent } from './klar-progress-ring.component';

@Component({
  standalone: true,
  imports: [KlarProgressRingComponent],
  template: `<klar-progress-ring [value]="v" [showValue]="show" [tone]="tone" [size]="size" />`,
})
class Host {
  v = 0.5;
  show = true;
  tone = 'var(--cat-abos)';
  size = 36;
}

describe('KlarProgressRingComponent', () => {
  it('renders SVG arc and percent label', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.detectChanges();
    const html = fix.nativeElement as HTMLElement;
    expect(html.querySelector('svg')).toBeTruthy();
    expect(html.querySelectorAll('circle').length).toBe(2);
    expect(html.textContent).toContain('50');
  });

  it('clamps high values into 0..100', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.componentInstance.v = 1.5;
    fix.detectChanges();
    expect((fix.nativeElement as HTMLElement).textContent).toContain('100');
  });

  it('hides percent label when showValue=false', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.componentInstance.show = false;
    fix.detectChanges();
    const html = fix.nativeElement as HTMLElement;
    expect(html.querySelector('span')).toBeFalsy();
  });
});
