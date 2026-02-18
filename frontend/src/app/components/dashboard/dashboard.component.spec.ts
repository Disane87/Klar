import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with current month and year', () => {
    const now = new Date();
    expect(component.currentMonth()).toBe(now.getMonth() + 1);
    expect(component.currentYear()).toBe(now.getFullYear());
  });

  it('should navigate to previous month', () => {
    component.currentMonth.set(3);
    component.currentYear.set(2026);
    component.previousMonth();
    expect(component.currentMonth()).toBe(2);
    expect(component.currentYear()).toBe(2026);
  });

  it('should wrap to December when going back from January', () => {
    component.currentMonth.set(1);
    component.currentYear.set(2026);
    component.previousMonth();
    expect(component.currentMonth()).toBe(12);
    expect(component.currentYear()).toBe(2025);
  });

  it('should navigate to next month', () => {
    component.currentMonth.set(3);
    component.currentYear.set(2026);
    component.nextMonth();
    expect(component.currentMonth()).toBe(4);
  });

  it('should wrap to January when going forward from December', () => {
    component.currentMonth.set(12);
    component.currentYear.set(2025);
    component.nextMonth();
    expect(component.currentMonth()).toBe(1);
    expect(component.currentYear()).toBe(2026);
  });

  it('should format currency in EUR', () => {
    const formatted = component.formatCurrency(1234.56);
    expect(formatted).toContain('1.234,56');
  });

  it('should compute spent percentage correctly', () => {
    component.summary.set({
      month: 1, year: 2026,
      totalIncome: 1000,
      totalExpenses: 250,
      remaining: 750,
      categoryBreakdown: [],
    });
    expect(component.spentPercentage()).toBe(25);
  });

  it('should return 0 percentage when no income', () => {
    component.summary.set({
      month: 1, year: 2026,
      totalIncome: 0,
      totalExpenses: 0,
      remaining: 0,
      categoryBreakdown: [],
    });
    expect(component.spentPercentage()).toBe(0);
  });
});
