import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BudgetService } from '../../services/budget.service';
import { IncomeService } from '../../services/income.service';
import { BudgetSummary, CategoryBreakdownItem } from '../../models/budget.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6 stagger-children">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold" style="color: var(--text-primary);">Dashboard</h1>
          <p style="color: var(--text-secondary);">
            {{ monthNames[currentMonth() - 1] }} {{ currentYear() }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="previousMonth()" class="glass-btn p-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button (click)="nextMonth()" class="glass-btn p-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Total Income -->
        <div class="glass p-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium" style="color: var(--text-secondary);">Total Income</span>
            <span class="text-2xl">💵</span>
          </div>
          <p class="text-2xl font-bold text-emerald-500">
            {{ formatCurrency(summary()?.totalIncome || 0) }}
          </p>
        </div>

        <!-- Total Expenses -->
        <div class="glass p-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium" style="color: var(--text-secondary);">Total Expenses</span>
            <span class="text-2xl">💳</span>
          </div>
          <p class="text-2xl font-bold text-red-400">
            {{ formatCurrency(summary()?.totalExpenses || 0) }}
          </p>
        </div>

        <!-- Remaining -->
        <div class="glass p-6 relative overflow-hidden">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium" style="color: var(--text-secondary);">Remaining</span>
            <span class="text-2xl">{{ (summary()?.remaining || 0) >= 0 ? '✅' : '⚠️' }}</span>
          </div>
          <p class="text-2xl font-bold"
             [class]="(summary()?.remaining || 0) >= 0 ? 'text-indigo-500' : 'text-red-500'">
            {{ formatCurrency(summary()?.remaining || 0) }}
          </p>
          <!-- Progress bar -->
          <div class="mt-3 h-2 rounded-full overflow-hidden" style="background: var(--glass-border);">
            <div class="h-full rounded-full transition-all duration-700 ease-out"
                 [style.width.%]="spentPercentage()"
                 [class]="spentPercentage() > 90 ? 'bg-red-500' : spentPercentage() > 70 ? 'bg-amber-500' : 'bg-indigo-500'">
            </div>
          </div>
          <p class="text-xs mt-1" style="color: var(--text-muted);">
            {{ spentPercentage().toFixed(0) }}% of income used
          </p>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Donut chart -->
        <div class="glass p-6">
          <h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Expense Breakdown</h2>
          @if (summary()?.categoryBreakdown?.length) {
            <div class="flex items-center gap-6">
              <!-- SVG Donut -->
              <svg viewBox="0 0 120 120" class="w-40 h-40 flex-shrink-0">
                @for (segment of donutSegments(); track segment.categoryId; let i = $index) {
                  <circle cx="60" cy="60" r="45" fill="none"
                          [attr.stroke]="segment.color"
                          stroke-width="18"
                          [attr.stroke-dasharray]="segment.dashArray"
                          [attr.stroke-dashoffset]="segment.dashOffset"
                          class="transition-all duration-700 ease-out"
                          style="transform: rotate(-90deg); transform-origin: center;" />
                }
                <text x="60" y="56" text-anchor="middle" class="text-xs fill-current"
                      style="fill: var(--text-secondary); font-size: 10px;">Spent</text>
                <text x="60" y="72" text-anchor="middle" class="font-bold fill-current"
                      style="fill: var(--text-primary); font-size: 14px;">
                  {{ formatCurrency(summary()?.totalExpenses || 0) }}
                </text>
              </svg>
              <!-- Legend -->
              <div class="space-y-2 flex-1">
                @for (item of summary()?.categoryBreakdown; track item.categoryId) {
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full" [style.background]="item.color"></div>
                      <span class="text-sm" style="color: var(--text-secondary);">{{ item.name }}</span>
                    </div>
                    <span class="text-sm font-medium">{{ formatCurrency(item.total) }}</span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="text-center py-8" style="color: var(--text-muted);">
              <p class="text-4xl mb-2">📭</p>
              <p>No expenses this month</p>
              <a routerLink="/budgets" class="glass-btn glass-btn-primary mt-4 inline-block text-sm">
                Add your first expense
              </a>
            </div>
          }
        </div>

        <!-- Quick stats / recent entries -->
        <div class="glass p-6">
          <h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Budget Health</h2>
          <div class="space-y-4">
            <!-- Stat bars for each category -->
            @for (item of summary()?.categoryBreakdown; track item.categoryId) {
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span style="color: var(--text-secondary);">{{ item.name }}</span>
                  <span class="font-medium">{{ formatCurrency(item.total) }}</span>
                </div>
                <div class="h-2 rounded-full overflow-hidden" style="background: var(--glass-border);">
                  <div class="h-full rounded-full transition-all duration-700 ease-out"
                       [style.width.%]="categoryPercentage(item)"
                       [style.background]="item.color">
                  </div>
                </div>
              </div>
            }

            @if (!summary()?.categoryBreakdown?.length) {
              <div class="text-center py-4" style="color: var(--text-muted);">
                <p>Set up categories to see budget health</p>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a routerLink="/budgets" class="glass p-4 text-center group cursor-pointer">
          <span class="text-2xl block mb-2 transition-transform group-hover:scale-125 duration-300">💳</span>
          <span class="text-sm font-medium" style="color: var(--text-secondary);">Add Expense</span>
        </a>
        <a routerLink="/incomes" class="glass p-4 text-center group cursor-pointer">
          <span class="text-2xl block mb-2 transition-transform group-hover:scale-125 duration-300">💵</span>
          <span class="text-sm font-medium" style="color: var(--text-secondary);">Add Income</span>
        </a>
        <a routerLink="/categories" class="glass p-4 text-center group cursor-pointer">
          <span class="text-2xl block mb-2 transition-transform group-hover:scale-125 duration-300">🏷️</span>
          <span class="text-sm font-medium" style="color: var(--text-secondary);">Categories</span>
        </a>
        <a routerLink="/households" class="glass p-4 text-center group cursor-pointer">
          <span class="text-2xl block mb-2 transition-transform group-hover:scale-125 duration-300">👨‍👩‍👧‍👦</span>
          <span class="text-sm font-medium" style="color: var(--text-secondary);">Family</span>
        </a>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  summary = signal<BudgetSummary | null>(null);
  currentMonth = signal(new Date().getMonth() + 1);
  currentYear = signal(new Date().getFullYear());

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  spentPercentage = computed(() => {
    const s = this.summary();
    if (!s || s.totalIncome === 0) return 0;
    return Math.min((s.totalExpenses / s.totalIncome) * 100, 100);
  });

  donutSegments = computed(() => {
    const breakdown = this.summary()?.categoryBreakdown || [];
    const total = breakdown.reduce((sum, item) => sum + item.total, 0);
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 45;
    let offset = 0;

    return breakdown.map((item) => {
      const pct = item.total / total;
      const dashLength = pct * circumference;
      const segment = {
        ...item,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: `${-offset}`,
      };
      offset += dashLength;
      return segment;
    });
  });

  constructor(
    private budgetService: BudgetService,
    private incomeService: IncomeService,
  ) {}

  ngOnInit() {
    this.loadSummary();
  }

  loadSummary() {
    this.budgetService
      .getSummary(this.currentMonth(), this.currentYear())
      .subscribe({
        next: (data) => this.summary.set(data),
        error: () => this.summary.set(null),
      });
  }

  previousMonth() {
    if (this.currentMonth() === 1) {
      this.currentMonth.set(12);
      this.currentYear.update((y) => y - 1);
    } else {
      this.currentMonth.update((m) => m - 1);
    }
    this.loadSummary();
  }

  nextMonth() {
    if (this.currentMonth() === 12) {
      this.currentMonth.set(1);
      this.currentYear.update((y) => y + 1);
    } else {
      this.currentMonth.update((m) => m + 1);
    }
    this.loadSummary();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  categoryPercentage(item: CategoryBreakdownItem): number {
    const total = this.summary()?.totalExpenses || 1;
    return Math.min((item.total / total) * 100, 100);
  }
}
