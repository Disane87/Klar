import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmBadgeDirective, type BadgeVariant } from '../../../shared/ui/hlm/hlm-badge.directive';
import { HlmCheckboxComponent } from '../../../shared/ui/hlm/hlm-checkbox.component';
import { HlmSelectNativeDirective } from '../../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarAvatarComponent } from '../../../shared/ui/klar-avatar.component';
import type { AnalyzeRow, ConfirmRowSelection } from '../../../core/csv-import/csv-import.types';

interface CategoryOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-csv-preview-row',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmBadgeDirective,
    HlmCheckboxComponent,
    HlmSelectNativeDirective,
    KlarAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex h-full items-center gap-3 border-l-2 py-2 px-4 overflow-hidden"
      [class.border-success]="row().status === 'NEW'"
      [class.border-warning]="row().status === 'RECURRING_SUGGESTION'"
      [class.border-muted]="row().status === 'DUPLICATE' || row().status === 'FIXED_COST_MATCH'"
      [class.opacity-60]="selection().skip"
    >
      <div class="flex items-center gap-3 md:flex-1 md:min-w-0">
        <hlm-checkbox
          [checked]="!selection().skip"
          [disabled]="row().status === 'FIXED_COST_MATCH' || row().status === 'DUPLICATE'"
          (checkedChange)="onIncludeChange($event)"
        />
        <klar-avatar [seed]="row().counterparty ?? '—'" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ row().counterparty ?? '—' }}</div>
          <div class="text-xs text-muted-foreground truncate">{{ row().purpose }}</div>
        </div>
      </div>

      <div class="flex items-center gap-3 md:w-auto">
        <span class="text-xs text-muted-foreground font-mono tabular-nums w-20">
          {{ row().date }}
        </span>
        <span
          class="font-mono tabular-nums text-sm w-24 text-right"
          [class.text-success]="row().amountCents > 0"
          [class.text-danger]="row().amountCents < 0"
        >
          {{ formatAmount(row().amountCents) }}
        </span>
        <span hlmBadge [variant]="badgeVariant()">{{ statusLabel() }}</span>
      </div>

      @if (showCategory()) {
        <div class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2 md:w-72">
          <select
            hlmSelect
            class="w-full scheme-dark text-base"
            [ngModel]="selection().categoryId ?? ''"
            (ngModelChange)="onCategoryChange($event)"
          >
            <option value="">— Kategorie —</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
          @if (row().suggestedCategoryConfidence === 'LEARNED') {
            <span hlmBadge variant="zinc" class="text-[10px]">Gelernt</span>
          } @else if (row().suggestedCategoryConfidence === 'EXACT') {
            <span hlmBadge variant="indigo" class="text-[10px]">Aus Fixkosten</span>
          }
        </div>
      }

      @if (row().status === 'RECURRING_SUGGESTION' && !selection().skip) {
        <label class="flex items-center gap-2 text-xs text-muted-foreground md:ml-2">
          <hlm-checkbox
            [checked]="selection().createNewRecurring ?? false"
            (checkedChange)="onRecurringToggle($event)"
          />
          <span>Als Fixkosten ({{ row().suggestedRecurring?.estimatedFrequency }})</span>
        </label>
      }
    </div>
  `,
})
export class CsvPreviewRowComponent {
  readonly row = input.required<AnalyzeRow>();
  readonly selection = input.required<ConfirmRowSelection>();
  readonly categories = input.required<CategoryOption[]>();
  readonly selectionChange = output<ConfirmRowSelection>();

  readonly badgeVariant = computed<BadgeVariant>(() => {
    switch (this.row().status) {
      case 'NEW':
        return 'emerald';
      case 'RECURRING_SUGGESTION':
        return 'amber';
      case 'FIXED_COST_MATCH':
        return 'indigo';
      default:
        return 'zinc';
    }
  });

  readonly statusLabel = computed(() => {
    switch (this.row().status) {
      case 'NEW':
        return 'Neu';
      case 'DUPLICATE':
        return 'Duplikat';
      case 'FIXED_COST_MATCH':
        return 'Fixkosten';
      case 'RECURRING_SUGGESTION':
        return 'Vorschlag';
    }
  });

  readonly showCategory = computed(
    () =>
      !this.selection().skip &&
      this.row().status !== 'DUPLICATE' &&
      this.row().status !== 'FIXED_COST_MATCH',
  );

  formatAmount(cents: number): string {
    return (
      (cents / 100).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' €'
    );
  }

  onIncludeChange(include: boolean): void {
    this.selectionChange.emit({ ...this.selection(), skip: !include });
  }

  onCategoryChange(categoryId: string): void {
    this.selectionChange.emit({
      ...this.selection(),
      categoryId: categoryId || undefined,
    });
  }

  onRecurringToggle(v: boolean): void {
    this.selectionChange.emit({ ...this.selection(), createNewRecurring: v });
  }
}
