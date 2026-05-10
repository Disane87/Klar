import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FixedCostsStore } from '../../core/fixed-costs/fixed-costs.store';
import type {
  FixedCostDto,
  FixedCostStatus,
} from '../../core/fixed-costs/fixed-costs.service';
import { KlarConfidenceBarComponent } from '../../shared/ui/klar-confidence-bar.component';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { FixedCostFormDialogComponent } from './fixed-cost-form-dialog.component';
import { ContractExtensionDialogComponent } from './contract-extension-dialog.component';

interface PageTab {
  id: 'active' | 'contracts' | 'candidates' | 'cancelled';
  label: string;
}

const TABS: PageTab[] = [
  { id: 'active',     label: 'Aktiv' },
  { id: 'contracts',  label: 'Verträge' },
  { id: 'candidates', label: 'Vorschläge' },
  { id: 'cancelled',  label: 'Beendet' },
];

@Component({
  selector: 'klar-vertraege-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    KlarConfidenceBarComponent,
    KlarTileComponent,
    KlarMoneyPipe,
    KlarIconComponent,
    KlarButtonComponent,
    KlarHeroComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      <klar-hero
        eyebrow="Auto-Erkennung aktiv"
        [title]="heroTitle()"
        sub="Klar erkennt wiederkehrende Buchungen aus CSV- und FinTS-Importen anhand von Betrag, Empfänger und Zyklus. Verträge sind erkannte Fixkosten mit Vertragsmetadaten — jeder Vertrag ist eine Fixkosten, aber nicht jede Fixkosten ist ein Vertrag."
      >
        <klar-icon heroEyebrowIcon name="planspiel" [size]="11" />
        <div heroActions class="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
          <klar-tile
            label="Monatslast fix"
            [value]="(totalMonthlyCents() | klarMoney) ?? '—'"
          />
          <klar-tile
            label="Jährlich hochgerechnet"
            [value]="(totalAnnualizedCents() | klarMoney) ?? '—'"
          />
          <klar-tile
            label="Nächste Aktion"
            [value]="nextActionLabel()"
            [tone]="nextActionLabel() === '—' ? 'neutral' : 'success'"
          />
        </div>
      </klar-hero>

      <!-- Renewal / cancel-by alerts -->
      @if (alerts().length > 0) {
        <section class="flex flex-col gap-2">
          @for (a of alerts(); track a.id) {
            <div
              class="flex items-start gap-3 px-4 py-3 rounded-md border"
              [style.background]="alertSurface(a)"
              [style.border-color]="alertBorder(a)"
            >
              <klar-icon
                name="planspiel"
                [size]="14"
                [style.color]="alertTone(a)"
              />
              <div class="flex-1 min-w-0">
                <div class="text-[12px] font-medium" [style.color]="alertTone(a)">
                  Kündigungsfrist nähert sich
                </div>
                <div class="text-[13px] text-(--fg) truncate">{{ a.name }}</div>
                <div class="text-[11px] text-(--fg-2) mono mt-0.5">
                  Kündigen bis {{ a.contract!.cancelByAt | date:'dd.MM.yyyy' }}
                </div>
              </div>
            </div>
          }
        </section>
      }

      <!-- Tabs + actions -->
      <div class="flex items-center gap-(--s-2) flex-wrap">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            class="btn"
            [class.primary]="currentTab() === tab.id"
            [attr.aria-pressed]="currentTab() === tab.id"
            (click)="setTab(tab.id)"
          >
            {{ tab.label }}
            <span class="text-[10px] mono ml-1 text-(--fg-3)">{{ tabCount(tab.id) }}</span>
          </button>
        }
        <span class="ml-auto"></span>
        <klar-button tone="ghost" size="sm" icon="planspiel" (click)="recompute()">
          Erneut scannen
        </klar-button>
        <klar-button tone="primary" size="sm" icon="plus" (click)="openCreateDialog()">
          Hinzufügen
        </klar-button>
      </div>

      <!-- Bulk-action bar — appears only when something is selected -->
      @if (selection().size > 0) {
        <div
          class="flex items-center gap-2 px-4 py-2 rounded-md border border-(--accent) bg-(--accent-soft) text-[13px]"
        >
          <span class="font-medium text-(--accent)">
            {{ selection().size }} ausgewählt
          </span>
          <span class="ml-auto"></span>
          <klar-button tone="ghost" size="sm" (click)="clearSelection()">
            Auswahl aufheben
          </klar-button>
          @if (currentTab() === 'candidates') {
            <klar-button tone="primary" size="sm" (click)="bulkConfirm()">
              Alle bestätigen
            </klar-button>
          }
          @if (currentTab() === 'active' || currentTab() === 'contracts') {
            <klar-button tone="warn" size="sm" (click)="bulkCancel()">
              Alle beenden
            </klar-button>
          }
        </div>
      }

      <!-- List -->
      @if (visibleItems().length === 0) {
        <div
          class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)"
        >
          @if (store.loading()) {
            <span>Lädt …</span>
          } @else {
            <div class="flex flex-col gap-2">
              <span class="eyebrow">Keine Treffer</span>
              <span class="text-[13px]">{{ emptyHint() }}</span>
            </div>
          }
        </div>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (c of visibleItems(); track c.id) {
            <li
              class="rounded-md border border-(--line-soft) bg-(--bg-1) overflow-hidden transition-colors hover:bg-(--bg-2)"
            >
              <div class="cat-bar px-4 py-3 grid gap-3 cursor-pointer"
                   style="grid-template-columns: auto 1fr auto auto; align-items: center;"
                   [style.--cat-color]="categoryTone(c)"
                   (click)="select(c)"
                   role="button"
                   tabindex="0"
                   (keydown.enter)="select(c)">
                <input
                  type="checkbox"
                  class="shrink-0"
                  [checked]="selection().has(c.id)"
                  (click)="$event.stopPropagation()"
                  (change)="toggleSelection(c.id)"
                  [attr.aria-label]="'Auswählen: ' + c.name"
                />
                <div class="min-w-0">
                  <div class="text-[14px] font-medium truncate text-(--fg) flex items-center gap-2">
                    {{ c.name }}
                    @if (c.contract) {
                      <span
                        class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style="background: var(--accent-soft); color: var(--accent);"
                      >Vertrag</span>
                    }
                    @if (c.source === 'USER_DEFINED') {
                      <span class="text-[10px] uppercase tracking-wider text-(--fg-3)">manuell</span>
                    }
                  </div>
                  @if (c.merchant) {
                    <div class="text-[11px] text-(--fg-2) truncate">{{ c.merchant }}</div>
                  }
                </div>
                <div class="hidden md:flex flex-col items-end leading-tight gap-1 min-w-[140px]">
                  <klar-confidence-bar [value]="c.confidence" />
                  <span class="text-[10px] eyebrow">{{ cycleLabel(c.cycle) }}</span>
                </div>
                <div class="flex flex-col items-end shrink-0">
                  <span class="text-[14px] mono text-(--fg)">{{ c.amountCents | klarMoney }}</span>
                  @if (c.nextRenewalAt) {
                    <span class="text-[10px] text-(--fg-3) mono">
                      ↻ {{ c.nextRenewalAt | date:'dd.MM.yy' }}
                    </span>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </div>

    <!-- Detail drawer -->
    @if (selected(); as c) {
      <div
        class="fixed inset-0 z-40 flex justify-end"
        style="background: var(--bg-overlay); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);"
        (click)="dismiss()"
      >
        <aside
          class="klar-pop h-full w-full max-w-md bg-(--bg-1) border-l border-(--line) overflow-y-auto"
          style="box-shadow: var(--shadow-modal);"
          role="dialog"
          [attr.aria-label]="c.name"
          (click)="$event.stopPropagation()"
        >
          <header class="flex items-center justify-between px-5 py-4 border-b border-(--line-soft) sticky top-0 bg-(--bg-1) z-10">
            <span class="eyebrow">{{ c.contract ? 'Vertragsdetail' : 'Fixkosten-Detail' }}</span>
            <button type="button" class="btn ghost icon-only" (click)="dismiss()" aria-label="Schließen">
              <klar-icon name="x" [size]="14" />
            </button>
          </header>

          <div class="px-5 py-5 flex flex-col gap-(--s-5)">
            <!-- Hero amount block -->
            <div class="flex flex-col gap-1">
              <span class="text-[13px] text-(--fg-2) truncate">{{ c.merchant ?? '—' }}</span>
              <span
                class="text-[28px] font-medium leading-none"
                style="font-family: var(--font-display); letter-spacing: -0.02em;"
              >{{ c.name }}</span>
              <span class="text-[40px] mono mt-2" [style.color]="amountTone(c.amountCents)">
                {{ c.amountCents | klarMoney }}
              </span>
              <span class="eyebrow">{{ cycleLabel(c.cycle) }}</span>
            </div>

            <!-- Confidence -->
            <div class="flex flex-col gap-2">
              <span class="eyebrow">Erkennungs-Konfidenz</span>
              <klar-confidence-bar [value]="c.confidence" />
              <span class="text-[11px] text-(--fg-2) mono">
                {{ (c.confidence * 100) | number:'1.0-0' }} % · {{ c.detectedFromTransactionIds.length }} Buchungen
                · Quelle: {{ sourceLabel(c.source) }}
              </span>
            </div>

            <!-- Metric tiles -->
            <div class="grid grid-cols-2 gap-2">
              <klar-tile
                label="Nächste Abbuchung"
                [value]="(c.nextRenewalAt ? (c.nextRenewalAt | date:'dd.MM.yyyy') : '—') ?? '—'"
              />
              <klar-tile
                label="Kündigen bis"
                [value]="(c.contract?.cancelByAt ? (c.contract!.cancelByAt | date:'dd.MM.yyyy') : '—') ?? '—'"
              />
              <klar-tile
                label="Status"
                [value]="statusLabel(c.status)"
              />
              <klar-tile
                label="Zyklus"
                [value]="cycleLabel(c.cycle)"
              />
            </div>

            <!-- Contract metadata (if extension exists) -->
            @if (c.contract; as ext) {
              <div class="flex flex-col gap-2 pt-3 border-t border-(--line-soft)">
                <span class="eyebrow">Vertragsdaten</span>
                @if (ext.providerName) {
                  <div class="flex justify-between text-[12px]">
                    <span class="text-(--fg-2)">Anbieter</span>
                    <span class="text-(--fg)">{{ ext.providerName }}</span>
                  </div>
                }
                @if (ext.contractHolder) {
                  <div class="flex justify-between text-[12px]">
                    <span class="text-(--fg-2)">Inhaber</span>
                    <span class="text-(--fg)">{{ ext.contractHolder }}</span>
                  </div>
                }
                @if (ext.contractNumber) {
                  <div class="flex justify-between text-[12px]">
                    <span class="text-(--fg-2)">Vertragsnummer</span>
                    <span class="text-(--fg) mono">{{ ext.contractNumber }}</span>
                  </div>
                }
                @if (ext.contractStartedAt) {
                  <div class="flex justify-between text-[12px]">
                    <span class="text-(--fg-2)">Vertrag seit</span>
                    <span class="text-(--fg) mono">{{ ext.contractStartedAt | date:'dd.MM.yyyy' }}</span>
                  </div>
                }
                @if (ext.notes) {
                  <div class="text-[12px] text-(--fg-2) mt-2 italic">{{ ext.notes }}</div>
                }
              </div>
            }

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 pt-2 border-t border-(--line-soft)">
              @if (c.status === 'CANDIDATE') {
                <klar-button tone="primary" (click)="confirmOne(c)">Bestätigen</klar-button>
              }
              @if (c.status === 'DETECTED' || c.status === 'CONFIRMED') {
                <klar-button tone="warn" (click)="cancelOne(c)">Beendet markieren</klar-button>
              }
              <klar-button tone="ghost" (click)="openContractDialog(c)">
                {{ c.contract ? 'Vertragsdaten bearbeiten' : 'Als Vertrag markieren' }}
              </klar-button>
              @if (c.contract) {
                <klar-button tone="ghost" (click)="demoteContract(c)">
                  Vertrags-Markierung entfernen
                </klar-button>
              }
              @if (c.source === 'USER_DEFINED') {
                <klar-button tone="ghost" (click)="openEditDialog(c)">Bearbeiten</klar-button>
              }
              <klar-button tone="ghost" (click)="remove(c)">Löschen</klar-button>
            </div>
          </div>
        </aside>
      </div>
    }
  `,
})
export class VertraegeComponent implements OnInit {
  protected readonly store = inject(FixedCostsStore);
  private readonly pageHeader = inject(PageHeaderService);
  private readonly dialog = inject(KlarDialogService);
  private readonly toast = inject(KlarToastService);

  protected readonly tabs = TABS;
  protected readonly currentTab = signal<PageTab['id']>('active');
  protected readonly selected = signal<FixedCostDto | null>(null);
  protected readonly selection = signal<Set<string>>(new Set());

  protected readonly activeCount = computed(() => this.store.active().length);
  protected readonly candidateCount = computed(() => this.store.candidates().length);
  protected readonly contractCount = computed(() => this.store.contracts().length);

  protected readonly heroTitle = computed(() => {
    const active = this.activeCount();
    const contracts = this.contractCount();
    const candidates = this.candidateCount();
    return `${active} aktive Fixkosten · ${contracts} davon Verträge · ${candidates} Vorschläge`;
  });

  protected readonly totalMonthlyCents = computed(() =>
    this.store.active()
      .filter(c => c.cycle === 'MONTHLY')
      .reduce((sum, c) => sum + c.amountCents, 0),
  );

  protected readonly totalAnnualizedCents = computed(() => {
    const active = this.store.active();
    let total = 0;
    for (const c of active) {
      switch (c.cycle) {
        case 'MONTHLY':     total += c.amountCents * 12; break;
        case 'QUARTERLY':   total += c.amountCents * 4;  break;
        case 'HALF_YEARLY': total += c.amountCents * 2;  break;
        case 'YEARLY':      total += c.amountCents;      break;
        case 'CUSTOM':      break; // unknown cadence — exclude
      }
    }
    return total;
  });

  protected readonly alerts = computed(() =>
    this.store.contracts().filter(c =>
      c.contract?.cancelByAt && this.daysUntil(c.contract.cancelByAt) <= 60,
    ),
  );

  protected readonly nextActionLabel = computed(() => {
    const all = this.alerts();
    if (all.length === 0) return '—';
    const next = all.reduce((acc, c) =>
      this.daysUntil(c.contract!.cancelByAt!) < this.daysUntil(acc.contract!.cancelByAt!)
        ? c
        : acc,
    );
    return `${next.name.split(' ')[0]} · ${this.daysUntil(next.contract!.cancelByAt!)} T`;
  });

  protected readonly visibleItems = computed<FixedCostDto[]>(() => {
    switch (this.currentTab()) {
      case 'active':     return this.store.active();
      case 'contracts':  return this.store.contracts();
      case 'candidates': return this.store.candidates();
      case 'cancelled':  return this.store.cancelled();
    }
  });

  protected readonly emptyHint = computed(() => {
    switch (this.currentTab()) {
      case 'candidates':
        return 'Keine offenen Vorschläge. Importiere weitere Buchungen oder triggere "Erneut scannen".';
      case 'contracts':
        return 'Noch keine Fixkosten als Verträge markiert. Wähle eine Fixkosten und klicke "Als Vertrag markieren".';
      case 'cancelled':
        return 'Keine beendeten Fixkosten.';
      default:
        return 'Noch keine aktiven Fixkosten. Importiere Buchungen oder lege manuell eine an.';
    }
  });

  ngOnInit(): void {
    this.pageHeader.set({
      title:          'Erkannte Fixkosten',
      subtitle:       'Auto-Erkennung aus CSV + FinTS · Verträge sind Fixkosten mit Vertragsdaten',
      showUserSwitch: true,
    });
  }

  protected setTab(id: PageTab['id']): void {
    this.currentTab.set(id);
    this.selected.set(null);
    this.clearSelection();
  }

  protected tabCount(id: PageTab['id']): number {
    switch (id) {
      case 'active':     return this.store.active().length;
      case 'contracts':  return this.store.contracts().length;
      case 'candidates': return this.store.candidates().length;
      case 'cancelled':  return this.store.cancelled().length;
    }
  }

  protected select(c: FixedCostDto): void {
    this.selected.set(c);
  }

  protected dismiss(): void {
    this.selected.set(null);
  }

  protected toggleSelection(id: string): void {
    this.selection.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected clearSelection(): void {
    this.selection.set(new Set());
  }

  protected async confirmOne(c: FixedCostDto): Promise<void> {
    await this.store.update(c.id, { status: 'CONFIRMED' });
    this.selected.set(null);
  }

  protected async cancelOne(c: FixedCostDto): Promise<void> {
    await this.store.update(c.id, { status: 'CANCELLED' });
    this.selected.set(null);
  }

  protected async bulkConfirm(): Promise<void> {
    const ids = [...this.selection()];
    const result = await this.store.bulkStatus(ids, 'CONFIRMED');
    this.clearSelection();
    if (result) {
      this.toast.success(`${result.updated} Fixkosten bestätigt`);
    }
  }

  protected async bulkCancel(): Promise<void> {
    const ids = [...this.selection()];
    const result = await this.store.bulkStatus(ids, 'CANCELLED');
    this.clearSelection();
    if (result) {
      this.toast.success(`${result.updated} Fixkosten beendet`);
    }
  }

  protected async remove(c: FixedCostDto): Promise<void> {
    await this.store.remove(c.id);
    this.selected.set(null);
  }

  protected async demoteContract(c: FixedCostDto): Promise<void> {
    await this.store.demoteContract(c.id);
    this.toast.success('Vertrags-Markierung entfernt');
    this.selected.set(null);
  }

  protected async recompute(): Promise<void> {
    const result = await this.store.recompute();
    if (result) {
      this.toast.success(`${result.created} Kandidaten erkannt (${result.replaced} ersetzt)`);
    }
  }

  protected openCreateDialog(): void {
    this.dialog.open({
      title: 'Fixkosten hinzufügen',
      component: FixedCostFormDialogComponent,
      width: 'md',
    });
  }

  protected openEditDialog(c: FixedCostDto): void {
    this.dialog.open({
      title: 'Fixkosten bearbeiten',
      component: FixedCostFormDialogComponent,
      width: 'md',
      inputs: { editing: c },
    });
    this.selected.set(null);
  }

  protected openContractDialog(c: FixedCostDto): void {
    this.dialog.open({
      title: c.contract ? 'Vertragsdaten bearbeiten' : 'Als Vertrag markieren',
      component: ContractExtensionDialogComponent,
      width: 'md',
      inputs: { fixedCost: c },
    });
    this.selected.set(null);
  }

  protected categoryTone(c: FixedCostDto): string {
    void c;
    return 'var(--cat-versicher)';
  }

  protected cycleLabel(cycle: FixedCostDto['cycle']): string {
    switch (cycle) {
      case 'MONTHLY':     return 'monatlich';
      case 'QUARTERLY':   return 'quartalsweise';
      case 'HALF_YEARLY': return 'halbjährlich';
      case 'YEARLY':      return 'jährlich';
      case 'CUSTOM':      return 'individuell';
    }
  }

  protected statusLabel(status: FixedCostStatus): string {
    switch (status) {
      case 'CANDIDATE': return 'Vorschlag';
      case 'DETECTED':  return 'Erkannt';
      case 'CONFIRMED': return 'Bestätigt';
      case 'CANCELLED': return 'Beendet';
    }
  }

  protected sourceLabel(source: FixedCostDto['source']): string {
    return source === 'USER_DEFINED' ? 'manuell' : 'Auto-Erkennung';
  }

  protected amountTone(cents: number): string {
    return cents < 0 ? 'var(--danger)' : 'var(--success)';
  }

  protected alertSurface(c: FixedCostDto): string {
    return c.status === 'CANCELLED' ? 'var(--danger-soft)' : 'var(--accent-soft)';
  }

  protected alertBorder(c: FixedCostDto): string {
    return c.status === 'CANCELLED'
      ? 'oklch(from var(--danger) l c h / 0.3)'
      : 'oklch(from var(--accent) l c h / 0.3)';
  }

  protected alertTone(c: FixedCostDto): string {
    return c.status === 'CANCELLED' ? 'var(--danger)' : 'var(--accent)';
  }

  private daysUntil(iso: string): number {
    const target = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.round((target - now) / (1000 * 60 * 60 * 24)));
  }
}
