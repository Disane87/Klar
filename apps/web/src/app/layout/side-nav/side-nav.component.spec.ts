import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SideNavComponent } from './side-nav.component';

describe('SideNavComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [SideNavComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(SideNavComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders nav items', () => {
    const fixture = TestBed.createComponent(SideNavComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('.nav-item');
    expect(links.length).toBeGreaterThan(0);
  });

  it('shows household name', () => {
    const fixture = TestBed.createComponent(SideNavComponent);
    fixture.componentRef.setInput('householdName', 'Familie Müller');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Familie Müller');
  });
});
