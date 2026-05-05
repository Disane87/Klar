import { Component, computed, inject, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSelectNativeDirective } from '../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { HouseholdStore } from '../../core/household/household.store';
import { ProjectsService, type ProjectStatus } from '../../core/projects/projects.service';
import { ProjekteStore } from '../../core/overview/projekte.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

const DEFAULT_COLOR = '#6366f1';

@Component({
  selector: 'app-project-create-dialog',
  standalone: true,
  imports: [
    KlarButtonComponent,
    HlmInputDirective,
    HlmLabelDirective,
    HlmSelectNativeDirective,
    KlarColorPickerComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="pcd-name">Name</label>
        <input id="pcd-name" hlmInput type="text"
               placeholder="z.B. Urlaub, Hauskauf..."
               [value]="name()"
               (input)="name.set($any($event.target).value)" />
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="pcd-desc">Beschreibung (optional)</label>
        <input id="pcd-desc" hlmInput type="text"
               placeholder="Kurzbeschreibung..."
               [value]="description()"
               (input)="description.set($any($event.target).value)" />
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="pcd-budget">Gesamtbudget (€, optional)</label>
        <input id="pcd-budget" hlmInput class="font-mono tabular-nums" type="text"
               inputmode="decimal" placeholder="0,00"
               [value]="budget()"
               (input)="budget.set($any($event.target).value)" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="pcd-start">Startdatum</label>
          <input id="pcd-start" hlmInput type="date"
                 [value]="startDate()"
                 (input)="startDate.set($any($event.target).value)" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="pcd-end">Enddatum</label>
          <input id="pcd-end" hlmInput type="date"
                 [value]="endDate()"
                 (input)="endDate.set($any($event.target).value)" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="pcd-status">Status</label>
        <select id="pcd-status" hlmSelect class="scheme-dark"
                (change)="status.set($any($event.target).value)">
          @for (opt of statusOptions; track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === status()">{{ opt.label }}</option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Farbe</label>
        <klar-color-picker [value]="color()" (valueChange)="color.set($event)" />
      </div>

      @if (err()) {
        <p class="text-[12px] text-(--color-expense)">{{ err() }}</p>
      }

      <div class="flex justify-end gap-2 pt-2 border-t border-(--border)">
        <klar-button tone="ghost" size="sm" (click)="cancel()">Abbrechen</klar-button>
        <klar-button tone="primary" size="sm"
                     [disabled]="!isValid()" [loading]="saving()" (click)="save()">
          Erstellen
        </klar-button>
      </div>
    </div>
  `,
})
export class ProjectCreateDialogComponent {
  private dialog    = inject(KlarDialogService);
  private household = inject(HouseholdStore);
  private projects  = inject(ProjectsService);
  private store     = inject(ProjekteStore);
  private toast     = inject(KlarToastService);

  readonly name        = signal('');
  readonly description = signal('');
  readonly budget      = signal('');
  readonly startDate   = signal('');
  readonly endDate     = signal('');
  readonly status      = signal<ProjectStatus>('ACTIVE');
  readonly color       = signal<string | null>(DEFAULT_COLOR);
  readonly saving      = signal(false);
  readonly err         = signal('');

  readonly statusOptions: { value: ProjectStatus; label: string }[] = [
    { value: 'ACTIVE',    label: 'Aktiv' },
    { value: 'COMPLETED', label: 'Abgeschlossen' },
    { value: 'ARCHIVED',  label: 'Archiviert' },
  ];

  readonly isValid = computed(() => this.name().trim().length > 0);

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    this.saving.set(true);
    this.err.set('');
    try {
      await this.projects.create(hid, {
        name:             this.name().trim(),
        color:            this.color() ?? DEFAULT_COLOR,
        description:      this.description().trim() || null,
        status:           this.status(),
        totalBudgetCents: this.parseBudget(this.budget()),
        startDate:        this.startDate() || null,
        endDate:          this.endDate() || null,
      });
      this.store.reload();
      this.dialog.close();
      this.toast.success('Projekt erstellt');
    } catch {
      this.err.set('Erstellen fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.dialog.close(); }

  private parseBudget(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = parseFloat(trimmed.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (isNaN(n)) return null;
    return Math.round(n * 100);
  }
}
