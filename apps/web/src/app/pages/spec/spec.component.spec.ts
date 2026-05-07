import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpecPageComponent } from './spec.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';

describe('SpecPageComponent', () => {
  function render(): { html: HTMLElement; cmp: SpecPageComponent } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SpecPageComponent],
      providers: [provideRouter([])],
    });
    const fix = TestBed.createComponent(SpecPageComponent);
    fix.detectChanges();
    return { html: fix.nativeElement as HTMLElement, cmp: fix.componentInstance };
  }

  it('sets the page header title', () => {
    const { html } = render();
    const header = TestBed.inject(PageHeaderService);
    expect(header.title()).toBe('Komponenten-Spec');
    expect(html.querySelector('.section-head')).toBeTruthy();
  });

  it('renders all primitive sections', () => {
    const { html } = render();
    const heads = Array.from(html.querySelectorAll('.section-head')).map(
      n => n.textContent?.trim() ?? '',
    );
    expect(heads).toContain('Buttons');
    expect(heads).toContain('Chips');
    expect(heads).toContain('Inputs');
    expect(heads).toContain('Cards & Rows');
    expect(heads).toContain('Setting Rows');
    expect(heads).toContain('Profile Card');
    expect(heads).toContain('Animations');
    expect(heads).toContain('Type Scale');
  });

  it('renders the full Fraunces type scale', () => {
    const { cmp } = render();
    expect(cmp['fontSizes']).toEqual([10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 56]);
  });

  it('increments pop counters on trigger', () => {
    const { cmp, html } = render();
    expect(cmp['popKey']()).toBe(0);
    const buttons = html.querySelectorAll('button.btn');
    const popBtn = Array.from(buttons).find(b => b.textContent?.includes('.klar-pop')) as HTMLButtonElement;
    popBtn.click();
    expect(cmp['popKey']()).toBe(1);
  });
});
