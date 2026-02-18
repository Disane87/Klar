import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../services/category.service';
import { BudgetCategory, CreateCategoryRequest } from '../../models/category.model';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 stagger-children">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold" style="color: var(--text-primary);">Categories</h1>
          <p style="color: var(--text-secondary);">Organize your expenses</p>
        </div>
        <button (click)="showForm.set(!showForm())" class="glass-btn glass-btn-primary">
          {{ showForm() ? 'Cancel' : '+ Add Category' }}
        </button>
      </div>

      @if (showForm()) {
        <div class="glass p-6 animate-scale-in">
          <h2 class="text-lg font-semibold mb-4">New Category</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Name</label>
              <input [(ngModel)]="form.name" class="glass-input" placeholder="e.g. Groceries" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Icon</label>
              <input [(ngModel)]="form.icon" class="glass-input" placeholder="e.g. shopping-cart" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--text-secondary);">Color</label>
              <div class="flex gap-2 items-center">
                <input [(ngModel)]="form.color" type="color" class="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                <input [(ngModel)]="form.color" class="glass-input" placeholder="#6366f1" />
              </div>
            </div>
          </div>
          <button (click)="save()" class="glass-btn glass-btn-primary mt-4">Save</button>
        </div>
      }

      <!-- Categories grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        @for (cat of categories(); track cat.id) {
          <div class="glass p-5 group relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1" [style.background]="cat.color"></div>
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                   [style.background]="cat.color">
                {{ cat.name.charAt(0) }}
              </div>
              <div>
                <p class="font-semibold" style="color: var(--text-primary);">{{ cat.name }}</p>
                <p class="text-xs" style="color: var(--text-muted);">{{ cat.icon || 'No icon' }}</p>
              </div>
            </div>
            <button (click)="remove(cat.id)"
                    class="absolute top-3 right-3 glass-btn p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-red-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        } @empty {
          <div class="glass p-8 text-center col-span-full" style="color: var(--text-muted);">
            <p class="text-4xl mb-2">🏷️</p>
            <p>No categories yet. Create one to organize your expenses!</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class CategoriesComponent implements OnInit {
  categories = signal<BudgetCategory[]>([]);
  showForm = signal(false);

  form: CreateCategoryRequest = {
    name: '',
    icon: '',
    color: '#6366f1',
  };

  constructor(private categoryService: CategoryService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.categoryService.getAll().subscribe((data) => this.categories.set(data));
  }

  save() {
    this.categoryService.create(this.form).subscribe(() => {
      this.showForm.set(false);
      this.form = { name: '', icon: '', color: '#6366f1' };
      this.load();
    });
  }

  remove(id: string) {
    this.categoryService.delete(id).subscribe(() => this.load());
  }
}
