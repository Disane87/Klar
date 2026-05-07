import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { HlmCheckboxComponent } from '../../../shared/ui/hlm/hlm-checkbox.component';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';

interface DemoItem {
  readonly id: string;
  readonly label: string;
}

/** Demo: Massenaktion — multi-select with bulk confirm. */
@Component({
  selector: 'klar-sample-bulk-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCheckboxComponent, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4)">
      <div class="card p-0">
        @for (item of items; track item.id) {
          <label class="setting-row interactive cursor-pointer">
            <hlm-checkbox
              [checked]="isChecked(item.id)"
              (checkedChange)="toggle(item.id, $event)"
            />
            <div class="setting-text">
              <div class="setting-label">{{ item.label }}</div>
            </div>
          </label>
        }
      </div>
      <klar-dialog-footer
        [confirmLabel]="'Aktion auf ' + selectedCount() + ' Eintrag(en) ausführen'"
        [confirmDisabled]="selectedCount() === 0"
      />
    </div>
  `,
})
export class SampleBulkDialogComponent {
  protected readonly items: DemoItem[] = [
    { id: '1', label: 'Lebensmittel' },
    { id: '2', label: 'Restaurant' },
    { id: '3', label: 'Bäcker' },
    { id: '4', label: 'Lieferdienst' },
  ];

  private readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly selectedCount = computed(() => this.selected().size);

  protected isChecked(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string, on: boolean): void {
    const next = new Set(this.selected());
    if (on) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }
}
