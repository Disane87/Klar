import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ContractsStore } from '../../core/contracts/contracts.store';
import type { ContractDto, ContractStatus } from '../../core/contracts/contracts.service';
import { KlarConfidenceBarComponent } from '../../shared/ui/klar-confidence-bar.component';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';

interface VertraegeTab {
  id: 'active' | 'candidates' | 'cancelled';
  label: string;
}

const TABS: VertraegeTab[] = [
  { id: 'active', label: 'Aktiv' },
  { id: 'candidates', label: 'Vorschläge' },
  { id: 'cancelled', label: 'Beendet' },
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
        [title]="vertraegeHeroTitle()"
        sub="Klar erkennt wiederkehrende Buchungen anhand von Betrag, Empfänger und Zyklus. Beim Bestätigen werden alle vergangenen Treffer rückwirkend mit dem Vertrag verknüpft."
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
            [tone]="nextActionLabel() ? 'success' : 'neutral'"
          />
        </div>
      </klar-hero>

      <!-- Renewal / price-change alerts -->
      @if (alerts().length > 0) {
        <section class="flex flex-col gap-2">
          @for (a of alerts(); track a.id) {
            <div
              class="flex items-start gap-3 px-4 py-3 rounded-md border"
              [style.background]="alertSurface(a)"
              [style.border-color]="alertBorder(a)"
            >
              <klar-icon
                [name]="a.cancelByAt ? 'planspiel' : 'shield'"
                [size]="14"
                [style.color]="alertTone(a)"
              />
              <div class="flex-1 min-w-0">
                <div class="text-[12px] font-medium" [style.color]="alertTone(a)">
                  {{ a.cancelByAt ? 'Kündigungsfrist nähert sich' : 'Wiederkehrende Buchung' }}
                </div>
                <div class="text-[13px] text-(--fg) truncate">{{ a.name }}</div>
                @if (a.cancelByAt) {
                  <div class="text-[11px] text-(--fg-2) mono mt-0.5">
                    Kündigen bis {{ a.cancelByAt | date:'dd.MM.yyyy' }}
                  </div>
                }
              </div>
            </div>
          }
        </section>
      }

      <!-- Tabs -->
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
      </div>

      <!-- List -->
      @if (visibleContracts().length === 0) {
        <div
          class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)"
        >
          @if (store.loading()) {
            <span>Lädt …</span>
          } @else {
            <div class="flex flex-col gap-2">
              <span class="eyebrow">Keine Treffer</span>
              <span class="text-[13px]">Noch keine Verträge in diesem Tab. Importiere weitere Buchungen oder triggere "Erneut scannen".</span>
            </div>
          }
        </div>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (c of visibleContracts(); track c.id) {
            <li
              class="rounded-md border border-(--line-soft) bg-(--bg-1) overflow-hidden transition-colors hover:bg-(--bg-2) cursor-pointer"
              (click)="select(c)"
              role="button"
              tabindex="0"
              (keydown.enter)="select(c)"
            >
              <div class="cat-bar px-4 py-3 grid gap-3"
                   style="grid-template-columns: 1fr auto auto; align-items: center;"
                   [style.--cat-color]="categoryTone(c)">
                <div class="min-w-0">
                  <div class="text-[14px] font-medium truncate text-(--fg)">{{ c.name }}</div>
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
            <span class="eyebrow">Vertragsdetail</span>
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
                {{ (c.confidence * 100) | number:'1.0-0' }} % · {{ c.detectedFromTransactionIds.length }} Buchungen erkannt
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
                [value]="(c.cancelByAt ? (c.cancelByAt | date:'dd.MM.yyyy') : '—') ?? '—'"
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

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 pt-2 border-t border-(--line-soft)">
              @if (c.status === 'CANDIDATE') {
                <klar-button tone="primary" (click)="confirm(c)">Bestätigen</klar-button>
              }
              @if (c.status === 'DETECTED' || c.status === 'CONFIRMED') {
                <klar-button tone="warn" (click)="cancel(c)">Beendet markieren</klar-button>
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
  protected readonly store = inject(ContractsStore);
  private readonly pageHeader = inject(PageHeaderService);

  protected readonly tabs = TABS;
  protected readonly currentTab = signal<VertraegeTab['id']>('active');
  protected readonly selected = signal<ContractDto | null>(null);

  protected readonly activeCount = computed(() => this.store.active().length);
  protected readonly candidateCount = computed(() => this.store.candidates().length);

  protected readonly vertraegeHeroTitle = computed(() =>
    `${this.activeCount()} erkannte Verträge · ${this.candidateCount()} Vorschläge zur Bestätigung`,
  );

  protected readonly totalMonthlyCents = computed(() =>
    this.store.active()
      .filter(c => c.cycle === 'MONTHLY')
      .reduce((sum, c) => sum + c.amountCents, 0),
  );

  protected readonly totalAnnualizedCents = computed(() => {
    const active = this.store.active();
    const monthly = active.filter(c => c.cycle === 'MONTHLY').reduce((s, c) => s + c.amountCents, 0);
    const yearly = active.filter(c => c.cycle === 'YEARLY').reduce((s, c) => s + c.amountCents, 0);
    const quarterly = active.filter(c => c.cycle === 'QUARTERLY').reduce((s, c) => s + c.amountCents, 0);
    return monthly * 12 + yearly + quarterly * 4;
  });

  protected readonly alerts = computed(() =>
    this.store.active().filter(c => c.cancelByAt && this.daysUntil(c.cancelByAt) <= 60),
  );

  protected readonly nextActionLabel = computed(() => {
    const all = this.alerts();
    if (all.length === 0) return '—';
    const next = all.reduce((acc, c) =>
      this.daysUntil(c.cancelByAt!) < this.daysUntil(acc.cancelByAt!) ? c : acc,
    );
    return `${next.name.split(' ')[0]} · ${this.daysUntil(next.cancelByAt!)} T`;
  });

  protected readonly visibleContracts = computed<ContractDto[]>(() => {
    switch (this.currentTab()) {
      case 'active':     return this.store.active();
      case 'candidates': return this.store.candidates();
      case 'cancelled':  return this.store.cancelled();
    }
  });

  ngOnInit(): void {
    this.pageHeader.set({
      title:          'Verträge',
      subtitle:       'Haushalt · Klar erkennt automatisch',
      showUserSwitch: true,
      // TODO(spec): Bundle zeigt "Erneut scannen" + "+ Vertrag hinzufügen" als
      // Header-Actions. Beides braucht Backend-Endpoints (manueller Rescan +
      // Manual-Create-Dialog) — kommt in Commit 2 / Folge-Phase.
    });
  }

  protected setTab(id: VertraegeTab['id']): void {
    this.currentTab.set(id);
    this.selected.set(null);
  }

  protected tabCount(id: VertraegeTab['id']): number {
    switch (id) {
      case 'active':     return this.store.active().length;
      case 'candidates': return this.store.candidates().length;
      case 'cancelled':  return this.store.cancelled().length;
    }
  }

  protected select(c: ContractDto): void {
    this.selected.set(c);
  }

  protected dismiss(): void {
    this.selected.set(null);
  }

  protected async confirm(c: ContractDto): Promise<void> {
    await this.store.update(c.id, { status: 'CONFIRMED' });
    this.selected.set(null);
  }

  protected async cancel(c: ContractDto): Promise<void> {
    await this.store.update(c.id, { status: 'CANCELLED' });
    this.selected.set(null);
  }

  protected async remove(c: ContractDto): Promise<void> {
    await this.store.remove(c.id);
    this.selected.set(null);
  }

  protected async recompute(): Promise<void> {
    await this.store.recompute();
  }

  protected categoryTone(c: ContractDto): string {
    // Without a categoryId→slug map yet, fall back to versicher tone (slate-blue)
    // which matches the bundle's default for contracts (versicher tone in NAV).
    void c;
    return 'var(--cat-versicher)';
  }

  protected cycleLabel(cycle: ContractDto['cycle']): string {
    switch (cycle) {
      case 'MONTHLY':   return 'monatlich';
      case 'QUARTERLY': return 'quartalsweise';
      case 'YEARLY':    return 'jährlich';
      case 'CUSTOM':    return 'individuell';
    }
  }

  protected statusLabel(status: ContractStatus): string {
    switch (status) {
      case 'CANDIDATE': return 'Vorschlag';
      case 'DETECTED':  return 'Erkannt';
      case 'CONFIRMED': return 'Bestätigt';
      case 'CANCELLED': return 'Beendet';
    }
  }

  protected amountTone(cents: number): string {
    return cents < 0 ? 'var(--danger)' : 'var(--success)';
  }

  protected alertSurface(c: ContractDto): string {
    return c.status === 'CANCELLED' ? 'var(--danger-soft)' : 'var(--accent-soft)';
  }

  protected alertBorder(c: ContractDto): string {
    return c.status === 'CANCELLED' ? 'oklch(from var(--danger) l c h / 0.3)' : 'oklch(from var(--accent) l c h / 0.3)';
  }

  protected alertTone(c: ContractDto): string {
    return c.status === 'CANCELLED' ? 'var(--danger)' : 'var(--accent)';
  }

  private daysUntil(iso: string): number {
    const target = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.round((target - now) / (1000 * 60 * 60 * 24)));
  }
}
