import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SideNavComponent } from './side-nav.component';
import { HouseholdStore } from '../../core/household/household.store';

const mockHousehold = {
  household: { id: 'hh-1', name: 'Familie Müller', createdAt: '', updatedAt: '' },
  role: 'OWNER' as const,
};

const mockHouseholdStore = {
  activeHousehold: signal(mockHousehold),
};

describe('SideNavComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [SideNavComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: HouseholdStore, useValue: mockHouseholdStore },
      ],
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

  it('shows household name from store', () => {
    const fixture = TestBed.createComponent(SideNavComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Familie Müller');
  });
});
