import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmCheckboxComponent } from '../../../shared/ui/hlm/hlm-checkbox.component';
import { HlmSelectNativeDirective } from '../../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarListItemComponent } from '../../../shared/ui/klar-list-item.component';
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
    HlmCheckboxComponent,
    HlmSelectNativeDirective,
    KlarListItemComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <klar-list-item
      [label]="row().counterparty ?? '—'"
      [sublabel]="sublabel()"
      [avatarSeed]="row().counterparty ?? '—'"
      [badge]="statusLabel()"
      [badgeClass]="badgeClass()"
      [value]="formatAmount(row().amountCents)"
      [valueClass]="amountClass()"
      [disabled]="selection().skip"
    >
      <hlm-checkbox
        klarLeading
        class="shrink-0"
        [checked]="!selection().skip"
        [disabled]="row().status === 'FIXED_COST_MATCH' || row().status === 'DUPLICATE'"
        (checkedChange)="onIncludeChange($event)"
      />

      @if (showCategory()) {
        <select
          klarTrailing
          hlmSelect
          class="scheme-dark text-sm w-44 shrink-0"
          [ngModel]="selection().categoryId ?? ''"
          (ngModelChange)="onCategoryChange($event)"
          (click)="$event.stopPropagation()"
        >
          <option value="">— Kategorie —</option>
          @for (cat of categories(); track cat.id) {
            <option [value]="cat.id">{{ cat.name }}</option>
          }
        </select>
      }

      @if (row().status === 'RECURRING_SUGGESTION' && !selection().skip) {
        <label
          klarTrailing
          class="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0"
          (click)="$event.stopPropagation()"
        >
          <hlm-checkbox
            [checked]="selection().createNewRecurring ?? false"
            (checkedChange)="onRecurringToggle($event)"
          />
          <span>Fixkost</span>
        </label>
      }
    </klar-list-item>
  `,
})
export class CsvPreviewRowComponent {
  readonly row = input.required<AnalyzeRow>();
  readonly selection = input.required<ConfirmRowSelection>();
  readonly categories = input.required<CategoryOption[]>();
  readonly selectionChange = output<ConfirmRowSelection>();

  readonly sublabel = computed(() => {
    const r = this.row();
    const date = r.date;
    const purpose = r.purpose ?? '';
    return purpose ? `${date} · ${purpose}` : date;
  });

  readonly badgeClass = computed(() => {
    switch (this.row().status) {
      case 'NEW':
        return 'bg-success/10 text-success';
      case 'RECURRING_SUGGESTION':
        return 'bg-warning/10 text-warning';
      case 'FIXED_COST_MATCH':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted/40 text-muted-foreground';
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

  readonly amountClass = computed(() =>
    this.row().amountCents > 0 ? 'text-success' : 'text-danger',
  );

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
