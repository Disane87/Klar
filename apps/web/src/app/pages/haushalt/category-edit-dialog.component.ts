import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import type { Category, CategoryType } from '@klar/shared';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { KlarIconPickerComponent } from '../../shared/ui/klar-icon-picker.component';
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

@Component({
  selector: 'app-category-edit-dialog',
  standalone: true,
  imports: [
    FormsModule,
    KlarButtonComponent,
    HlmInputDirective,
    HlmLabelDirective,
    KlarSelectComponent,
    KlarDialogFooterComponent,
    KlarDialogCalloutComponent,
    KlarColorPickerComponent,
    KlarIconPickerComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="cat-name">Name</label>
        <input id="cat-name" hlmInput type="text"
               placeholder="z.B. Lebensmittel"
               [value]="name()"
               (input)="name.set($any($event.target).value)" />
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
      </div>

      @if (isEdit()) {
        <klar-dialog-callout tone="info" icon="info">
          Der Typ kann nach dem Anlegen nicht mehr geändert werden.
        </klar-dialog-callout>
      }

      <!-- Aussehen — color + icon group -->
      <div class="flex flex-col gap-3 rounded-md border border-(--border) p-3 bg-(--surface-2)/30">
        <p class="text-[10px] uppercase tracking-wider font-semibold text-(--text-muted)">Aussehen</p>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel>Farbe</label>
          <klar-color-picker [value]="color()" (valueChange)="color.set($event)" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel>Icon</label>
          <klar-icon-picker [value]="icon()" (valueChange)="icon.set($event)" />
        </div>
      </div>

      <klar-dialog-footer
        [confirmLabel]="isEdit() ? 'Speichern' : 'Anlegen'"
        [confirmDisabled]="!isValid()"
        [confirmLoading]="saving()"
        [autoCloseOnCancel]="false"
        (cancel)="onCancel()"
        (confirm)="onSave()"
      >
        @if (isEdit() && !category()?.isDefault) {
          <klar-button start tone="danger" size="sm" [loading]="deleting()" (click)="onDelete()">
            Löschen
          </klar-button>
        }
      </klar-dialog-footer>
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
  readonly color = signal<string | null>('#22c55e');
  readonly icon = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleting = signal(false);

  readonly isEdit = computed(() => this.category() !== null);
  readonly isValid = computed(() => !!this.name().trim() && !!this.color());

  ngOnInit(): void {
    const c = this.category();
    if (c) {
      this.name.set(c.name);
      this.type.set(c.type);
      this.color.set(c.color);
      this.icon.set(c.icon ?? null);
      return;
    }
    const pre = this.prefillName();
    if (pre) this.name.set(pre);
  }

  async onSave(): Promise<void> {
    if (this.saving() || this.deleting()) return;
    const name = this.name().trim();
    const color = this.color();
    if (!name || !color) return;
    this.saving.set(true);
    try {
      const c = this.category();
      if (c) {
        await this.store.update(c.id, {
          name,
          color,
          icon: this.icon() || null,
        });
        this.toast.success('Kategorie aktualisiert');
      } else {
        const created = await this.store.create({
          name,
          type: this.type(),
          color,
          icon: this.icon() || null,
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
