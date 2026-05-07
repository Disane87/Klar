import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import type { Category, CategoryType } from '@klar/shared';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarSelectComponent, type KlarSelectOption } from '../../shared/ui/klar-select.component';

const TYPE_LABELS: Record<CategoryType, string> = {
  FIXED_INCOME: 'Festes Einkommen',
  VARIABLE_INCOME: 'Variables Einkommen',
  FIXED_EXPENSE: 'Fixkosten',
  VARIABLE_EXPENSE: 'Variable Ausgabe',
  SAVINGS: 'Sparen',
  INCOME: 'Einnahme (legacy)',
  EXPENSE: 'Ausgabe (legacy)',
};

const TYPE_OPTIONS: CategoryType[] = [
  'FIXED_INCOME',
  'VARIABLE_INCOME',
  'FIXED_EXPENSE',
  'VARIABLE_EXPENSE',
  'SAVINGS',
];

const PRESET_COLORS = [
  '#22c55e', '#4ade80', '#0ea5e9', '#60a5fa', '#a78bfa',
  '#f472b6', '#fb923c', '#fbbf24', '#f87171', '#94a3b8',
  '#34d399', '#facc15',
];

@Component({
  selector: 'app-category-edit-dialog',
  standalone: true,
  imports: [FormsModule, KlarButtonComponent, KlarInputComponent, HlmLabelDirective, KlarSelectComponent],
  template: `
    <div class="flex flex-col gap-5 p-1">
      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="cat-name">Name</label>
        <klar-input
          id="cat-name"
          type="text"
          placeholder="z.B. Lebensmittel"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
        />
      </div>

      <!-- Type — beim Edit nicht änderbar -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="cat-type">Typ</label>
        <klar-select
          [options]="typeSelectOpts"
          [value]="type()"
          [disabled]="isEdit()"
          (valueChange)="type.set($any($event))"
          ariaLabel="Kategorie-Typ"
        />
        @if (isEdit()) {
          <span class="text-xs text-muted-foreground">Typ kann nach Anlegen nicht mehr geändert werden.</span>
        }
      </div>

      <!-- Farbe -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Farbe</label>
        <div class="flex flex-wrap gap-2">
          @for (c of presetColors; track c) {
            <button
              type="button"
              class="size-9 rounded-full border-2 transition-transform hover:scale-110 min-h-[44px] min-w-[44px]"
              [style.background]="c"
              [style.border-color]="color() === c ? 'var(--color-primary)' : 'transparent'"
              (click)="color.set(c)"
              [attr.aria-label]="c"
            ></button>
          }
        </div>
        <div class="flex items-center gap-2">
          <input
            type="color"
            class="size-9 rounded border border-input bg-transparent cursor-pointer"
            [value]="color()"
            (input)="color.set($any($event.target).value)"
          />
          <span class="text-xs text-muted-foreground font-mono">{{ color() }}</span>
        </div>
      </div>

      <!-- Icon (optional) -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="cat-icon">Icon (optional)</label>
        <klar-input
          id="cat-icon"
          type="text"
          placeholder="z.B. shopping-cart"
          [ngModel]="icon()"
          (ngModelChange)="icon.set($event)"
        />
        <span class="text-xs text-muted-foreground">Lucide- oder iconify-Name</span>
      </div>

      <!-- Actions -->
      <div class="flex justify-between gap-2 pt-3 border-t border-border">
        @if (isEdit() && !category()?.isDefault) {
          <klar-button tone="danger" [loading]="deleting()" (click)="onDelete()">
            Löschen
          </klar-button>
        } @else {
          <span></span>
        }
        <div class="flex gap-2">
          <klar-button tone="ghost" (click)="onCancel()">Abbrechen</klar-button>
          <klar-button
            tone="primary"
            [loading]="saving()"
            [disabled]="!name().trim() || !color()"
            (click)="onSave()"
          >
            {{ isEdit() ? 'Speichern' : 'Anlegen' }}
          </klar-button>
        </div>
      </div>
    </div>
  `,
})
export class CategoryEditDialogComponent implements OnInit {
  category = input<Category | null>(null);
  prefillName = input<string | null>(null);
  onCreated = input<((cat: Category) => void) | null>(null);

  private store = inject(CategoriesStore);
  private toast = inject(KlarToastService);
  private dialogRef = inject<DialogRef<unknown>>(DialogRef);
  private confirm = inject(KlarConfirmService);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly typeSelectOpts: KlarSelectOption<CategoryType>[] = TYPE_OPTIONS.map((t) => ({
    value: t,
    label: TYPE_LABELS[t],
  }));

  readonly name = signal('');
  readonly type = signal<CategoryType>('VARIABLE_EXPENSE');
  readonly color = signal('#94a3b8');
  readonly icon = signal('');
  readonly saving = signal(false);
  readonly deleting = signal(false);

  readonly presetColors = PRESET_COLORS;
  readonly isEdit = () => this.category() !== null;

  ngOnInit(): void {
    const c = this.category();
    if (c) {
      this.name.set(c.name);
      this.type.set(c.type);
      this.color.set(c.color);
      this.icon.set(c.icon ?? '');
      return;
    }
    const pre = this.prefillName();
    if (pre) this.name.set(pre);
  }

  protected typeLabel(t: CategoryType): string {
    return TYPE_LABELS[t] ?? t;
  }

  async onSave(): Promise<void> {
    if (this.saving() || this.deleting()) return;
    const name = this.name().trim();
    if (!name || !this.color()) return;
    this.saving.set(true);
    try {
      const c = this.category();
      if (c) {
        await this.store.update(c.id, {
          name,
          color: this.color(),
          icon: this.icon().trim() || null,
        });
        this.toast.success('Kategorie aktualisiert');
      } else {
        const created = await this.store.create({
          name,
          type: this.type(),
          color: this.color(),
          icon: this.icon().trim() || null,
        });
        this.toast.success('Kategorie angelegt');
        this.onCreated()?.(created);
      }
      this.dialogRef.close();
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail;
      this.toast.error(msg ?? 'Speichern fehlgeschlagen');
    } finally {
      this.saving.set(false);
    }
  }

  async onDelete(): Promise<void> {
    const c = this.category();
    if (!c) return;
    const confirmed = await this.confirm.ask({
      title: 'Kategorie löschen?',
      message: `Kategorie "${c.name}" löschen?`,
      detail: 'Falls bereits Buchungen darauf verweisen, wird sie nur archiviert.',
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.deleting.set(true);
    try {
      await this.store.remove(c.id);
      this.toast.success('Kategorie entfernt');
      this.dialogRef.close();
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail;
      this.toast.error(msg ?? 'Löschen fehlgeschlagen');
    } finally {
      this.deleting.set(false);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
