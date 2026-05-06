import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrnHoverCardImports } from '@spartan-ng/brain/hover-card';
import { HlmCheckboxComponent } from '../../../shared/ui/hlm/hlm-checkbox.component';
import { KlarComboboxComponent } from '../../../shared/ui/klar-combobox.component';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
import { KlarListItemComponent } from '../../../shared/ui/klar-list-item.component';
import type { AnalyzeRow, ConfirmRowSelection } from '../../../core/csv-import/csv-import.types';

interface CategoryOption {
  id: string;
  name: string;
}

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: 'wöchentlich',
  MONTHLY: 'monatlich',
  QUARTERLY: 'quartalsweise',
  YEARLY: 'jährlich',
  CUSTOM: 'individuell',
};

@Component({
  selector: 'app-csv-preview-row',
  standalone: true,
  imports: [
    CommonModule,
    BrnHoverCardImports,
    HlmCheckboxComponent,
    KlarComboboxComponent,
    KlarIconComponent,
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
      [hoverCard]="false"
    >
      <hlm-checkbox
        klarLeading
        class="shrink-0"
        [checked]="!selection().skip"
        [disabled]="row().status === 'DUPLICATE'"
        (checkedChange)="onIncludeChange($event)"
      />

      @if (row().status === 'FIXED_COST_MATCH' && row().matchedRecurring) {
        <brn-hover-card klarTrailing class="inline-flex shrink-0">
          <button
            type="button"
            brnHoverCardTrigger
            class="inline-flex items-center justify-center size-6 rounded-full text-primary hover:bg-primary/10 transition-colors"
            aria-label="Details zur Fixkost"
            (click)="$event.stopPropagation()"
          >
            <klar-icon name="alert" [size]="14" />
          </button>
          <ng-template brnHoverCardContent>
            <div class="rounded-md border border-(--border) bg-(--surface) p-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] min-w-64 max-w-80">
              <div class="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Erkannte Fixkost</div>
              <div class="text-sm font-medium truncate">{{ row().matchedRecurring!.name }}</div>
              <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <span class="text-muted-foreground">Betrag</span>
                <span class="font-mono tabular-nums text-right">{{ formatAmount(row().matchedRecurring!.amountCents) }}</span>
                <span class="text-muted-foreground">Frequenz</span>
                <span class="text-right">{{ freqLabel(row().matchedRecurring!.frequency) }}</span>
                @if (row().matchedRecurring!.dayOfMonth !== null) {
                  <span class="text-muted-foreground">Buchungstag</span>
                  <span class="font-mono tabular-nums text-right">{{ row().matchedRecurring!.dayOfMonth }}.</span>
                }
                @if (row().matchedRecurring!.note) {
                  <span class="text-muted-foreground col-span-2 mt-1">Notiz</span>
                  <span class="col-span-2 text-[11px] text-(--text-2)">{{ row().matchedRecurring!.note }}</span>
                }
              </div>
              @if (selection().skip) {
                <div class="mt-3 pt-2 border-t border-(--border) text-[11px] text-muted-foreground">
                  Wird übersprungen — über die Checkbox kannst du den Match überschreiben und die Buchung trotzdem importieren.
                </div>
              } @else {
                <div class="mt-3 pt-2 border-t border-(--border) text-[11px] text-warning">
                  Override aktiv — wird trotz Match als reguläre Buchung importiert.
                </div>
              }
            </div>
          </ng-template>
        </brn-hover-card>
      }

      @if (showCategory()) {
        <div klarTrailing class="w-44 shrink-0" (click)="$event.stopPropagation()">
          <klar-combobox
            [items]="categories()"
            [value]="selection().categoryId ?? null"
            [idOf]="catId"
            [displayWith]="catName"
            placeholder="— Kategorie —"
            searchPlaceholder="Kategorie suchen…"
            [addLabel]="addCategoryLabel"
            ariaLabel="Kategorie wählen"
            (valueChange)="onCategoryChange($event)"
            (addNew)="onAddCategory($event)"
          />
        </div>
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
  readonly addCategory = output<{ rowIndex: number; name: string }>();

  readonly catId = (c: CategoryOption) => c.id;
  readonly catName = (c: CategoryOption) => c.name;
  readonly addCategoryLabel = (q: string) => `"${q}" als neue Kategorie anlegen`;

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
        return this.selection().skip
          ? 'bg-primary/10 text-primary'
          : 'bg-warning/10 text-warning';
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
        return this.selection().skip ? 'Fixkosten' : 'Fixkosten · Override';
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
      this.row().status !== 'DUPLICATE',
  );

  formatAmount(cents: number): string {
    return (
      (cents / 100).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' €'
    );
  }

  freqLabel(f: string): string {
    return FREQ_LABEL[f] ?? f;
  }

  onIncludeChange(include: boolean): void {
    const sel = this.selection();
    if (include) {
      this.selectionChange.emit({ ...sel, skip: false, skipReason: undefined });
    } else {
      this.selectionChange.emit({ ...sel, skip: true, skipReason: 'user' });
    }
  }

  onCategoryChange(categoryId: string | null): void {
    this.selectionChange.emit({
      ...this.selection(),
      categoryId: categoryId ?? undefined,
    });
  }

  onAddCategory(name: string): void {
    this.addCategory.emit({ rowIndex: this.row().rowIndex, name });
  }

  onRecurringToggle(v: boolean): void {
    this.selectionChange.emit({ ...this.selection(), createNewRecurring: v });
  }
}
