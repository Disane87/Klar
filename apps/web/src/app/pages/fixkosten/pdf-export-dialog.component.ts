import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../shared/ui/klar-select.component';
import { KlarScopeSegmentComponent } from '../../shared/ui/klar-scope-segment.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { PdfReportService, type PdfLayout, type PdfGrouping, type PdfOrientation, type FixkostenPdfData } from '../../core/pdf/pdf-report.service';

interface PdfTemplate {
  id: PdfLayout;
  label: string;
  hint:  string;
}

const TEMPLATES: PdfTemplate[] = [
  { id: 'compact', label: 'Kompakt',     hint: '1 Seite · Tabelle' },
  { id: 'report',  label: 'Bericht',     hint: 'Mehrseitig · Charts' },
  { id: 'auszug',  label: 'Kontoauszug', hint: 'Druckfreundlich' },
];

const GROUPING_OPTS: KlarSelectOption<PdfGrouping>[] = [
  { value: 'kategorie', label: 'nach Kategorie' },
  { value: 'datum',     label: 'nach Datum' },
  { value: 'person',    label: 'nach Person' },
  { value: 'keine',     label: 'ohne Gruppierung' },
];

/**
 * PDF Export Dialog (Klar Design Pearl). Mirrors the design proposal: sidebar
 * with template/grouping/orientation/content + live preview pane. Triggered
 * from the Fixkosten page header.
 */
@Component({
  selector: 'app-pdf-export-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarDialogFooterComponent, KlarButtonComponent, KlarSelectComponent,
    KlarScopeSegmentComponent, KlarIconComponent,
  ],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 min-h-0 -m-1">
      <aside class="flex flex-col gap-4 min-w-0">
        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] uppercase tracking-widest text-(--text-muted) font-medium">Vorlage</span>
          <div class="flex flex-col gap-1.5">
            @for (t of templates; track t.id) {
              <button
                type="button"
                class="flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-left cursor-pointer transition-colors"
                [class.border-(--border)]="layout() !== t.id"
                [class.bg-transparent]="layout() !== t.id"
                [class.border-(--accent)]="layout() === t.id"
                [class.bg-(--accent)/10]="layout() === t.id"
                (click)="layout.set(t.id)"
              >
                <klar-icon name="file-text" [size]="14" class="shrink-0 text-(--text-2)" />
                <div class="flex flex-col min-w-0">
                  <span class="text-[12px] font-medium text-(--text)">{{ t.label }}</span>
                  <span class="text-[10px] text-(--text-muted) truncate">{{ t.hint }}</span>
                </div>
              </button>
            }
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] uppercase tracking-widest text-(--text-muted) font-medium">Gruppierung</span>
          <klar-select
            [options]="groupingOpts"
            [value]="grouping()"
            (valueChange)="grouping.set($any($event))"
            ariaLabel="Gruppierung"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] uppercase tracking-widest text-(--text-muted) font-medium">Ausrichtung</span>
          <klar-scope-segment
            [options]="orientationOpts"
            [(value)]="orientationModel"
            ariaLabel="Ausrichtung"
          />
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-[10px] uppercase tracking-widest text-(--text-muted) font-medium">Inhalt</span>
          <label class="flex items-center gap-2 text-[12px] text-(--text-2) cursor-pointer">
            <input type="checkbox" [checked]="includeNotes()" (change)="includeNotes.set($any($event.target).checked)" />
            <span>Notizen mit ausgeben</span>
          </label>
          <label class="flex items-center gap-2 text-[12px] text-(--text-2) cursor-pointer">
            <input type="checkbox" [checked]="includeCharts()" (change)="includeCharts.set($any($event.target).checked)" />
            <span>Diagramme einfügen</span>
          </label>
          <label class="flex items-center gap-2 text-[12px] text-(--text-2) cursor-pointer">
            <input type="checkbox" [checked]="includeBank()" (change)="includeBank.set($any($event.target).checked)" />
            <span>Bankzeile (IBAN gekürzt)</span>
          </label>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] uppercase tracking-widest text-(--text-muted) font-medium">Sichtbarer Bereich</span>
          <div class="text-[12px] text-(--text-2) leading-snug">
            <strong class="text-(--text)">{{ data().householdName }}</strong>
            <span class="opacity-70"> · {{ data().monthLabel }}</span><br />
            <span class="opacity-70">{{ summaryText() }}</span>
          </div>
        </div>
      </aside>

      <section
        class="rounded-md border border-(--border) bg-(--surface-2) overflow-auto p-4 min-h-[280px] max-h-[60dvh]"
      >
        <div
          class="bg-white text-black rounded-sm shadow-sm mx-auto p-5 grid grid-cols-1 gap-3"
          [class.aspect-[210/297]]="orientation() === 'portrait'"
          [class.aspect-[297/210]]="orientation() === 'landscape'"
          [style.max-width]="orientation() === 'portrait' ? '320px' : '440px'"
        >
          <header class="flex items-start justify-between border-b border-gray-200 pb-2">
            <div>
              <div class="text-[8px] uppercase tracking-widest text-gray-500">Klar · Haushaltsbuch</div>
              <div class="text-[14px] font-semibold tracking-tight">{{ headerTitle() }}</div>
              <div class="text-[9px] text-gray-500">{{ data().monthLabel }} · {{ data().householdName }}</div>
            </div>
            <div class="size-6 rounded bg-gray-900 text-white grid place-items-center text-[11px] font-semibold">K</div>
          </header>

          <div class="grid grid-cols-3 gap-2 text-[8px]">
            <div class="rounded border border-gray-200 p-1.5">
              <div class="text-gray-500 uppercase tracking-wider text-[6px]">Einnahmen</div>
              <div class="font-semibold text-emerald-700 tabular-nums mt-0.5">{{ formatCents(data().incomeCents) }}</div>
            </div>
            <div class="rounded border border-gray-200 p-1.5">
              <div class="text-gray-500 uppercase tracking-wider text-[6px]">Ausgaben</div>
              <div class="font-semibold text-rose-700 tabular-nums mt-0.5">{{ formatCents(-data().expenseCents) }}</div>
            </div>
            <div class="rounded border border-gray-200 p-1.5">
              <div class="text-gray-500 uppercase tracking-wider text-[6px]">Überschuss</div>
              <div class="font-semibold tabular-nums mt-0.5"
                   [class.text-emerald-700]="data().surplusCents >= 0"
                   [class.text-rose-700]="data().surplusCents < 0">
                {{ formatCents(data().surplusCents) }}
              </div>
            </div>
          </div>

          <div class="text-[8px]">
            <div class="grid grid-cols-[1fr_60px_60px] gap-2 border-b border-gray-300 pb-1 text-gray-500 uppercase tracking-wider text-[6px]">
              <span>{{ grouping() === 'datum' ? 'Datum / Position' : 'Position' }}</span>
              <span class="text-right">Frequenz</span>
              <span class="text-right">Monatsäq.</span>
            </div>
            @for (preview of previewRows(); track preview.label) {
              <div class="grid grid-cols-[1fr_60px_60px] gap-2 py-0.5 border-b border-gray-100">
                <span class="truncate">{{ preview.label }}</span>
                <span class="text-right text-gray-500">{{ preview.frequency }}</span>
                <span class="text-right tabular-nums"
                      [class.text-rose-700]="preview.amountCents < 0"
                      [class.text-emerald-700]="preview.amountCents > 0">
                  {{ formatCents(preview.amountCents) }}
                </span>
              </div>
            }
          </div>

          <footer class="border-t border-gray-200 pt-1 text-[7px] text-gray-500 flex justify-between">
            <span>Vorlage „{{ activeTemplate().label }}"</span>
            <span>Seite 1 / {{ layout() === 'compact' ? '1' : '2+' }}</span>
          </footer>
        </div>
      </section>
    </div>

    <klar-dialog-footer
      [autoCloseOnCancel]="false"
      [showConfirm]="false"
      (cancel)="cancel()"
    >
      <span start class="text-[11px] text-(--text-muted) self-center">
        Vorlage „{{ activeTemplate().label }}" · Klar v0.9.4
      </span>
      <klar-button start tone="ghost" size="sm" (click)="send()" [disabled]="sending()">
        Versenden
      </klar-button>
      <klar-button start tone="primary" size="sm" [loading]="saving()" (click)="save()">
        PDF speichern
      </klar-button>
    </klar-dialog-footer>
  `,
})
export class PdfExportDialogComponent {
  readonly data = input.required<PdfDialogInputData>();

  private dialog = inject(KlarDialogService);
  private pdf    = inject(PdfReportService);
  private toast  = inject(KlarToastService);

  readonly templates       = TEMPLATES;
  readonly groupingOpts    = GROUPING_OPTS;
  readonly orientationOpts = [
    { id: 'portrait',  label: 'Hoch' },
    { id: 'landscape', label: 'Quer' },
  ];

  readonly layout       = signal<PdfLayout>('compact');
  readonly grouping     = signal<PdfGrouping>('kategorie');
  readonly orientation  = signal<PdfOrientation>('portrait');
  readonly includeNotes = signal(true);
  readonly includeCharts = signal(true);
  readonly includeBank  = signal(false);
  readonly saving       = signal(false);
  readonly sending      = signal(false);

  // Bridge for klar-scope-segment which expects a model
  get orientationModel() { return this.orientation(); }
  set orientationModel(v: string) { this.orientation.set(v as PdfOrientation); }

  readonly activeTemplate = computed(() =>
    this.templates.find(t => t.id === this.layout()) ?? this.templates[0],
  );

  readonly summaryText = computed(() => {
    const d = this.data();
    return `${d.itemCount} Positionen · ${d.categoryCount} Kategorien`;
  });

  readonly headerTitle = computed(() =>
    this.data().kind === 'fixkosten' ? 'Fixkosten-Übersicht' : 'Buchungen',
  );

  readonly previewRows = computed(() => this.data().previewRows.slice(0, 8));

  formatCents(cents: number): string {
    const abs = Math.abs(cents) / 100;
    const formatted = abs.toLocaleString('de-DE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const sign = cents < 0 ? '−' : cents > 0 ? '+' : '';
    return `${sign}${formatted} €`;
  }

  cancel(): void { this.dialog.close(); }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.pdf.exportFixkosten({
        ...this.data().fixkosten,
        options: this.collectOptions(),
      });
      this.dialog.close();
      this.toast.success('PDF gespeichert');
    } catch {
      this.toast.error('PDF-Export fehlgeschlagen');
    } finally {
      this.saving.set(false);
    }
  }

  send(): void {
    this.toast.info('Versenden ist noch nicht angebunden');
  }

  private collectOptions() {
    return {
      layout:        this.layout(),
      grouping:      this.grouping(),
      orientation:   this.orientation(),
      includeNotes:  this.includeNotes(),
      includeCharts: this.includeCharts(),
      includeBank:   this.includeBank(),
    };
  }
}

export interface PdfDialogInputData {
  kind: 'fixkosten' | 'buchungen';
  householdName: string;
  monthLabel: string;
  itemCount: number;
  categoryCount: number;
  incomeCents: number;
  expenseCents: number;
  surplusCents: number;
  previewRows: { label: string; frequency: string; amountCents: number }[];
  fixkosten: FixkostenPdfData;
}
