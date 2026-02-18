import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { BudgetEntry, CreateBudgetEntryRequest } from '../../models/budget.model';
import { BudgetCategory } from '../../models/category.model';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 stagger-children">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold" style="color: var(--text-primary);">Budget Entries</h1>
          <p style="color: var(--text-secondary);">Manage your monthly expenses</p>
        </div>
        <button (click)="showForm.set(!showForm())" class="glass-btn glass-btn-primary">
          {{ showForm() ? 'Cancel' : '+ Add Expense' }}
        </button>
      </div>

      <!-- Add form -->
      @if (showForm()) {
        <div class="glass p-6 animate-scale-in">
          <h2 class="text-lg font-semibold mb-4">New Expense</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Name</label>
              <input [(ngModel)]="form.name" class="glass-input" placeholder="e.g. Netflix" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Amount</label>
              <input [(ngModel)]="form.amount" type="number" step="0.01" class="glass-input" placeholder="0.00" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Category</label>
              <select [(ngModel)]="form.categoryId" class="glass-input">
                <option value="">Select category</option>
                @for (cat of categories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Month / Year</label>
              <div class="flex gap-2">
                <input [(ngModel)]="form.month" type="number" min="1" max="12" class="glass-input" placeholder="Month" />
                <input [(ngModel)]="form.year" type="number" class="glass-input" placeholder="Year" />
              </div>
            </div>
            <div class="flex items-center gap-2 mt-6">
              <input [(ngModel)]="form.isRecurring" type="checkbox" id="recurring"
                     class="w-4 h-4 accent-indigo-500" />
              <label for="recurring" class="text-sm" style="color: var(--text-secondary);">Recurring monthly</label>
            </div>
          </div>
          <button (click)="save()" class="glass-btn glass-btn-primary mt-4">Save</button>
        </div>
      }

      <!-- Month filter -->
      <div class="flex gap-2">
        <input [(ngModel)]="filterMonth" type="number" min="1" max="12"
               (ngModelChange)="load()" class="glass-input w-24" placeholder="Month" />
        <input [(ngModel)]="filterYear" type="number"
               (ngModelChange)="load()" class="glass-input w-28" placeholder="Year" />
      </div>

      <!-- Entries list -->
      <div class="space-y-3 stagger-children">
        @for (entry of entries(); track entry.id) {
          <div class="glass p-4 flex items-center justify-between group">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                   [style.background]="entry.category?.color || '#6366f1'">
                {{ (entry.category?.name || '?').charAt(0) }}
              </div>
              <div>
                <p class="font-medium" style="color: var(--text-primary);">{{ entry.name }}</p>
                <p class="text-xs" style="color: var(--text-muted);">
                  {{ entry.category?.name || 'Uncategorized' }}
                  @if (entry.isRecurring) { · Recurring }
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-semibold text-red-400">-{{ formatCurrency(entry.amount) }}</span>
              <button (click)="remove(entry.id)"
                      class="glass-btn p-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        } @empty {
          <div class="glass p-8 text-center" style="color: var(--text-muted);">
            <p class="text-4xl mb-2">📭</p>
            <p>No expenses yet. Add your first one above!</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class BudgetsComponent implements OnInit {
  entries = signal<BudgetEntry[]>([]);
  categories = signal<BudgetCategory[]>([]);
  showForm = signal(false);

  filterMonth = new Date().getMonth() + 1;
  filterYear = new Date().getFullYear();

  form: CreateBudgetEntryRequest = {
    name: '',
    amount: 0,
    categoryId: '',
    isRecurring: true,
    month: this.filterMonth,
    year: this.filterYear,
  };

  constructor(
    private budgetService: BudgetService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit() {
    this.load();
    this.categoryService.getAll().subscribe((cats) => this.categories.set(cats));
  }

  load() {
    this.budgetService
      .getAll(this.filterMonth, this.filterYear)
      .subscribe((data) => this.entries.set(data));
  }

  save() {
    this.form.month = this.filterMonth;
    this.form.year = this.filterYear;
    this.budgetService.create(this.form).subscribe(() => {
      this.showForm.set(false);
      this.form = { name: '', amount: 0, categoryId: '', isRecurring: true, month: this.filterMonth, year: this.filterYear };
      this.load();
    });
  }

  remove(id: string) {
    this.budgetService.delete(id).subscribe(() => this.load());
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
