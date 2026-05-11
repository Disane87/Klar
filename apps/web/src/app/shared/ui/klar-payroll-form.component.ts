import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import {
  calculateNet,
  type Bundesland,
  type GrossToNetInput,
  type Krankenversicherung,
  type RentenversicherungRegion,
  type Steuerklasse,
} from '@klar/shared';
import { KlarMoneyInputComponent } from './klar-money-input.component';
import { KlarSelectComponent, type KlarSelectOption } from './klar-select.component';
import { KlarSwitchComponent } from './klar-switch.component';
import { KlarDonutChartComponent, type DonutSegment } from './klar-donut-chart.component';
import { KlarMoneyPipe } from '../pipes/klar-money.pipe';
import { HlmInputDirective } from './hlm/hlm-input.directive';
import { HlmLabelDirective } from './hlm/hlm-label.directive';
import { KlarButtonComponent } from './klar-button.component';

const STEUERKLASSE_OPTIONS: KlarSelectOption[] = [
  { value: '1', label: 'StKl 1 — ledig' },
  { value: '2', label: 'StKl 2 — alleinerziehend' },
  { value: '3', label: 'StKl 3 — verh. (Hauptverd.)' },
  { value: '4', label: 'StKl 4 — verh. (gleich)' },
  { value: '5', label: 'StKl 5 — verh. (Nebenverd.)' },
  { value: '6', label: 'StKl 6 — Nebenjob' },
];

const BUNDESLAND_OPTIONS: KlarSelectOption[] = [
  { value: 'BW', label: 'Baden-Württemberg' },
  { value: 'BY', label: 'Bayern' },
  { value: 'BE', label: 'Berlin' },
  { value: 'BB', label: 'Brandenburg' },
  { value: 'HB', label: 'Bremen' },
  { value: 'HH', label: 'Hamburg' },
  { value: 'HE', label: 'Hessen' },
  { value: 'MV', label: 'Mecklenburg-Vorpommern' },
  { value: 'NI', label: 'Niedersachsen' },
  { value: 'NW', label: 'Nordrhein-Westfalen' },
  { value: 'RP', label: 'Rheinland-Pfalz' },
  { value: 'SL', label: 'Saarland' },
  { value: 'SN', label: 'Sachsen' },
  { value: 'ST', label: 'Sachsen-Anhalt' },
  { value: 'SH', label: 'Schleswig-Holstein' },
  { value: 'TH', label: 'Thüringen' },
];

const KV_OPTIONS: KlarSelectOption[] = [
  { value: 'gesetzlich', label: 'Gesetzlich' },
  { value: 'privat',     label: 'Privat (PKV)' },
];

const RV_REGION_OPTIONS: KlarSelectOption[] = [
  { value: 'west', label: 'West' },
  { value: 'ost',  label: 'Ost' },
];

const PERIOD_OPTIONS: KlarSelectOption[] = [
  { value: 'monthly', label: 'pro Monat' },
  { value: 'yearly',  label: 'pro Jahr' },
];

const KINDER_OPTIONS: KlarSelectOption[] = [
  { value: '0',   label: 'keine' },
  { value: '0.5', label: '0,5' },
  { value: '1',   label: '1' },
  { value: '1.5', label: '1,5' },
  { value: '2',   label: '2' },
  { value: '2.5', label: '2,5' },
  { value: '3',   label: '3' },
  { value: '3.5', label: '3,5' },
  { value: '4',   label: '4' },
];

export interface PayrollApplyEvent {
  /** Computed monthly net in cents — what should land in `amountCents`. */
  nettoMonthlyCents: number;
  /** The full input snapshot to persist as `payrollInput`. */
  input: GrossToNetInput;
}

/**
 * Compact embeddable gross-to-net form. Used in the recurring create/edit
 * dialogs — when the user toggles "Aus Brutto berechnen" this component
 * collects the inputs, shows a live breakdown, and on `apply` emits the
 * computed monthly net and the input snapshot back to the host dialog.
 */
@Component({
  selector: 'klar-payroll-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-(--s-3)' },
  imports: [
    KlarMoneyInputComponent, KlarSelectComponent, KlarSwitchComponent,
    KlarDonutChartComponent, KlarMoneyPipe, HlmInputDirective, HlmLabelDirective,
    KlarButtonComponent,
  ],
  template: `
    <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-(--s-3)">
      <div class="flex flex-col gap-1">
        <label hlmLabel for="pf-brutto">Brutto</label>
        <klar-money-input inputId="pf-brutto" [(amountCents)]="grossCents" placeholder="0,00" />
      </div>
      <div class="flex flex-col gap-1 min-w-[140px]">
        <label hlmLabel>Zeitraum</label>
        <klar-select [(value)]="period" [options]="periodOptions" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-(--s-3)">
      <div class="flex flex-col gap-1">
        <label hlmLabel>Steuerklasse</label>
        <klar-select [(value)]="steuerklasse" [options]="steuerklasseOptions" />
      </div>
      <div class="flex flex-col gap-1">
        <label hlmLabel>Bundesland</label>
        <klar-select [(value)]="bundesland" [options]="bundeslandOptions" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-(--s-3) items-end">
      <div class="flex flex-col gap-1">
        <label hlmLabel for="pf-birth">Geburtsjahr</label>
        <input hlmInput id="pf-birth" type="number" min="1900" max="2030"
               [value]="birthYear()" (input)="onBirthYear($event)" />
      </div>
      <div class="flex flex-col gap-1">
        <label hlmLabel>Kinderfreibeträge</label>
        <klar-select [(value)]="kinderStr" [options]="kinderOptions" />
      </div>
    </div>

    <klar-switch label="Kirchensteuer" [(checked)]="kirchensteuer" />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-(--s-3) items-end">
      <div class="flex flex-col gap-1">
        <label hlmLabel>Krankenversicherung</label>
        <klar-select [(value)]="krankenversicherung" [options]="kvOptions" />
      </div>
      @if (krankenversicherung() === 'gesetzlich') {
        <div class="flex flex-col gap-1">
          <label hlmLabel for="pf-kvz">KV-Zusatz (%)</label>
          <input hlmInput id="pf-kvz" type="number" min="0" max="10" step="0.1"
                 [value]="kvZusatzbeitragPct()" (input)="onZusatz($event)" />
        </div>
      } @else {
        <div class="flex flex-col gap-1">
          <label hlmLabel for="pf-pkv">PKV-Beitrag / Monat</label>
          <klar-money-input inputId="pf-pkv" [(amountCents)]="pkvBeitragMonthlyCents" placeholder="0,00" />
        </div>
      }
    </div>

    <!-- ── Result strip ────────────────────────────────────── -->
    <div class="rounded-(--r-6) border border-(--line-soft) bg-(--bg-2) p-(--s-3) flex items-center gap-(--s-3)">
      <klar-donut-chart
        [segments]="donutSegments()"
        [size]="100"
        [thickness]="20"
        [showLegend]="false"
        ariaLabel="Verteilung Netto Steuern Sozialabgaben"
      />
      <div class="flex-1 min-w-0">
        <div class="text-[10px] uppercase tracking-widest text-(--fg-3)">Netto / Monat</div>
        <div class="font-mono text-(--success)"
             style="font-family: var(--font-display); font-size: 22px; font-variant-numeric: tabular-nums; line-height: 1.1;">
          {{ result().monthly.nettoCents | klarMoney }}
        </div>
        <div class="text-[11px] text-(--fg-3) mt-1">
          Steuern −{{ result().monthly.steuernCents | klarMoney }} · SV −{{ result().monthly.sozialabgabenCents | klarMoney }}
        </div>
      </div>
      <klar-button tone="primary" (click)="apply()">Übernehmen</klar-button>
    </div>
  `,
})
export class KlarPayrollFormComponent {
  /** Optional initial input — pre-fills the form when editing an existing payrollInput. */
  readonly initial = input<GrossToNetInput | null>(null);

  readonly applied = output<PayrollApplyEvent>();

  protected readonly steuerklasseOptions = STEUERKLASSE_OPTIONS;
  protected readonly bundeslandOptions   = BUNDESLAND_OPTIONS;
  protected readonly kvOptions           = KV_OPTIONS;
  protected readonly rvRegionOptions     = RV_REGION_OPTIONS;
  protected readonly periodOptions       = PERIOD_OPTIONS;
  protected readonly kinderOptions       = KINDER_OPTIONS;

  readonly grossCents                       = signal<number | null>(400000);
  readonly period                           = signal<'monthly' | 'yearly'>('monthly');
  readonly steuerklasse                     = signal<string>('1');
  readonly bundesland                       = signal<string>('NW');
  readonly kirchensteuer                    = signal(false);
  readonly birthYear                        = signal<number>(1990);
  readonly kinderStr                        = signal<string>('0');
  readonly krankenversicherung              = signal<Krankenversicherung>('gesetzlich');
  readonly kvZusatzbeitragPct               = signal<number>(1.7);
  readonly pkvBeitragMonthlyCents           = signal<number | null>(null);
  readonly rentenversicherungRegion         = signal<RentenversicherungRegion>('west');
  readonly geldwerterVorteilMonthlyCents    = signal<number | null>(0);
  readonly lohnsteuerFreibetragYearlyCents  = signal<number | null>(0);

  constructor() {
    effect(() => {
      const i = this.initial();
      if (!i) return;
      this.grossCents.set(i.grossCents);
      this.period.set(i.period);
      this.steuerklasse.set(String(i.steuerklasse));
      this.bundesland.set(i.bundesland);
      this.kirchensteuer.set(i.kirchensteuer);
      this.birthYear.set(i.birthYear);
      this.kinderStr.set(String(i.kinderfreibetraege));
      this.krankenversicherung.set(i.krankenversicherung);
      this.kvZusatzbeitragPct.set(i.kvZusatzbeitragPct);
      this.pkvBeitragMonthlyCents.set(i.pkvBeitragMonthlyCents ?? null);
      this.rentenversicherungRegion.set(i.rentenversicherungRegion);
      this.geldwerterVorteilMonthlyCents.set(i.geldwerterVorteilMonthlyCents);
      this.lohnsteuerFreibetragYearlyCents.set(i.lohnsteuerFreibetragYearlyCents);
    });
  }

  readonly input = computed<GrossToNetInput>(() => ({
    grossCents:                       this.grossCents() ?? 0,
    period:                           this.period(),
    steuerklasse:                     parseInt(this.steuerklasse(), 10) as Steuerklasse,
    bundesland:                       this.bundesland() as Bundesland,
    kirchensteuer:                    this.kirchensteuer(),
    birthYear:                        this.birthYear(),
    kinderfreibetraege:               parseFloat(this.kinderStr()),
    krankenversicherung:              this.krankenversicherung(),
    kvZusatzbeitragPct:               this.kvZusatzbeitragPct(),
    pkvBeitragMonthlyCents:           this.pkvBeitragMonthlyCents() ?? undefined,
    rentenversicherungRegion:         this.rentenversicherungRegion(),
    geldwerterVorteilMonthlyCents:    this.geldwerterVorteilMonthlyCents() ?? 0,
    lohnsteuerFreibetragYearlyCents:  this.lohnsteuerFreibetragYearlyCents() ?? 0,
  }));

  readonly result = computed(() => calculateNet(this.input()));

  readonly donutSegments = computed<DonutSegment[]>(() => {
    const m = this.result().monthly;
    return [
      { label: 'Netto',         value: m.nettoCents,        color: 'oklch(from var(--success) l c h)' },
      { label: 'Steuern',       value: m.steuernCents,      color: 'oklch(from var(--danger) l c h)' },
      { label: 'Sozialabgaben', value: m.sozialabgabenCents, color: 'oklch(from var(--warn) l c h)' },
    ];
  });

  apply(): void {
    this.applied.emit({
      nettoMonthlyCents: this.result().monthly.nettoCents,
      input: this.input(),
    });
  }

  onBirthYear(e: Event): void {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.birthYear.set(v);
  }

  onZusatz(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.kvZusatzbeitragPct.set(v);
  }
}
