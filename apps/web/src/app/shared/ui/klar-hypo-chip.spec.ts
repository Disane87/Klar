import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { KlarHypoChipComponent } from './klar-hypo-chip.component';

@Component({
  standalone: true,
  imports: [KlarHypoChipComponent],
  template: `<klar-hypo-chip [label]="label" [ariaLabel]="aria" />`,
})
class Host {
  label = 'Hypothetisch';
  aria = 'Test';
}

describe('KlarHypoChipComponent', () => {
  it('renders the label inside .hypo-chip with aria-label', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fix = TestBed.createComponent(Host);
    fix.detectChanges();
    const span = fix.nativeElement.querySelector('span.hypo-chip') as HTMLElement;
    expect(span).toBeTruthy();
    expect(span.textContent).toBe('Hypothetisch');
    expect(span.getAttribute('aria-label')).toBe('Test');
  });
});
