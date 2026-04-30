import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TopBarComponent } from './top-bar.component';

describe('TopBarComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [TopBarComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows title', () => {
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.componentRef.setInput('title', 'Fixkosten');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fixkosten');
  });

  it('shows month chip', () => {
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.componentRef.setInput('monthChip', 'März 2026');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('März 2026');
  });
});
