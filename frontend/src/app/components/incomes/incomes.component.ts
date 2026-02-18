import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncomeService } from '../../services/income.service';
import { Income, CreateIncomeRequest } from '../../models/income.model';

@Component({
  selector: 'app-incomes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 stagger-children">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold" style="color: var(--text-primary);">Income Sources</h1>
          <p style="color: var(--text-secondary);">Track your monthly earnings</p>
        </div>
        <button (click)="showForm.set(!showForm())" class="glass-btn glass-btn-primary">
          {{ showForm() ? 'Cancel' : '+ Add Income' }}
        </button>
      </div>

      @if (showForm()) {
        <div class="glass p-6 animate-scale-in">
          <h2 class="text-lg font-semibold mb-4">New Income</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Source Name</label>
              <input [(ngModel)]="form.name" class="glass-input" placeholder="e.g. Monthly Salary" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Amount</label>
              <input [(ngModel)]="form.amount" type="number" step="0.01" class="glass-input" placeholder="0.00" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Month</label>
              <input [(ngModel)]="form.month" type="number" min="1" max="12" class="glass-input" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Year</label>
              <input [(ngModel)]="form.year" type="number" class="glass-input" />
            </div>
          </div>
          <button (click)="save()" class="glass-btn glass-btn-primary mt-4">Save</button>
        </div>
      }

      <!-- Total -->
      <div class="glass p-4 flex items-center justify-between">
        <span class="font-medium" style="color: var(--text-secondary);">Total Income This Month</span>
        <span class="text-xl font-bold text-emerald-500">
          {{ formatCurrency(totalIncome()) }}
        </span>
      </div>

      <!-- Incomes list -->
      <div class="space-y-3 stagger-children">
        @for (income of incomes(); track income.id) {
          <div class="glass p-4 flex items-center justify-between group">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600
                          flex items-center justify-center text-white text-lg">
                💵
              </div>
              <div>
                <p class="font-medium" style="color: var(--text-primary);">{{ income.name }}</p>
                <p class="text-xs" style="color: var(--text-muted);">
                  {{ income.month }}/{{ income.year }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-semibold text-emerald-500">+{{ formatCurrency(income.amount) }}</span>
              <button (click)="remove(income.id)"
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
            <p class="text-4xl mb-2">💰</p>
            <p>No income sources yet. Add your salary above!</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class IncomesComponent implements OnInit {
  incomes = signal<Income[]>([]);
  showForm = signal(false);

  filterMonth = new Date().getMonth() + 1;
  filterYear = new Date().getFullYear();

  form: CreateIncomeRequest = {
    name: '',
    amount: 0,
    month: this.filterMonth,
    year: this.filterYear,
  };

  totalIncome = signal(0);

  constructor(private incomeService: IncomeService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.incomeService.getAll(this.filterMonth, this.filterYear).subscribe((data) => {
      this.incomes.set(data);
      this.totalIncome.set(data.reduce((sum, i) => sum + Number(i.amount), 0));
    });
  }

  save() {
    this.form.month = this.filterMonth;
    this.form.year = this.filterYear;
    this.incomeService.create(this.form).subscribe(() => {
      this.showForm.set(false);
      this.form = { name: '', amount: 0, month: this.filterMonth, year: this.filterYear };
      this.load();
    });
  }

  remove(id: string) {
    this.incomeService.delete(id).subscribe(() => this.load());
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
