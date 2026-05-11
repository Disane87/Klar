import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  calculateNet,
  type Bundesland,
  type GrossToNetInput,
  type Krankenversicherung,
  type RentenversicherungRegion,
  type Steuerklasse,
} from '@klar/shared';
import { KlarHeroComponent } from '../../../shared/ui/klar-hero.component';
import { KlarFormFieldComponent } from '../../../shared/ui/klar-form-field.component';
import { KlarInputComponent } from '../../../shared/ui/klar-input.component';
import { KlarMoneyInputComponent } from '../../../shared/ui/klar-money-input.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../../shared/ui/klar-select.component';
import { KlarSwitchComponent } from '../../../shared/ui/klar-switch.component';
import { KlarDonutChartComponent, type DonutSegment } from '../../../shared/ui/klar-donut-chart.component';
import { KlarMoneyPipe } from '../../../shared/pipes/klar-money.pipe';
import { PageHeaderService } from '../../../core/page-header/page-header.service';

const STEUERKLASSE_OPTIONS: KlarSelectOption[] = [
  { value: '1', label: 'Steuerklasse 1 — ledig' },
  { value: '2', label: 'Steuerklasse 2 — alleinerziehend' },
  { value: '3', label: 'Steuerklasse 3 — verheiratet (Hauptverdiener)' },
  { value: '4', label: 'Steuerklasse 4 — verheiratet (gleich)' },
  { value: '5', label: 'Steuerklasse 5 — verheiratet (Nebenverdiener)' },
  { value: '6', label: 'Steuerklasse 6 — Nebenjob' },
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

@Component({
  selector: 'klar-brutto-netto-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    KlarHeroComponent,
    KlarFormFieldComponent,
    KlarInputComponent,
    KlarMoneyInputComponent,
    KlarSelectComponent,
    KlarSwitchComponent,
    KlarDonutChartComponent,
    KlarMoneyPipe,
  ],
  host: { class: 'flex flex-col flex-1 min-h-0 min-w-0 overflow-y-auto' },
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16 max-w-3xl w-full mx-auto">

      <klar-hero
        eyebrow="Tools"
        title="Brutto-Netto-Rechner"
        sub="Brutto eingeben — Netto inklusive Lohnsteuer, Soli, Kirchensteuer und Sozialabgaben."
      />

      <!-- ── Gehalt ─────────────────────────────────────── -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Gehalt</span>
        </header>
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 p-5">
          <klar-form-field label="Brutto" for="bn-brutto">
            <klar-money-input inputId="bn-brutto" [(amountCents)]="grossCents" placeholder="0,00" />
          </klar-form-field>
          <klar-form-field label="Zeitraum">
            <klar-select [(value)]="period" [options]="periodOptions" />
          </klar-form-field>
        </div>
      </section>

      <!-- ── Steuer ─────────────────────────────────────── -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Steuer</span>
        </header>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
          <klar-form-field label="Steuerklasse">
            <klar-select [(value)]="steuerklasse" [options]="steuerklasseOptions" />
          </klar-form-field>
          <klar-form-field label="Bundesland">
            <klar-select [(value)]="bundesland" [options]="bundeslandOptions" />
          </klar-form-field>
          <klar-form-field label="Geburtsjahr">
            <klar-input type="number" [ngModel]="birthYearStr()" (ngModelChange)="onBirthYearStr($event)" />
          </klar-form-field>
          <klar-form-field label="Kinderfreibeträge">
            <klar-select [(value)]="kinderStr" [options]="kinderOptions" />
          </klar-form-field>
        </div>
        <div class="px-5 pb-5">
          <klar-switch
            label="Kirchensteuer"
            description="9 % vom LSt-Betrag (8 % in Bayern und Baden-Württemberg)."
            [(checked)]="kirchensteuer"
          />
        </div>
      </section>

      <!-- ── Sozialversicherung ─────────────────────────── -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Sozialversicherung</span>
        </header>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
          <klar-form-field label="Krankenversicherung">
            <klar-select [(value)]="krankenversicherung" [options]="kvOptions" />
          </klar-form-field>
          @if (krankenversicherung() === 'gesetzlich') {
            <klar-form-field label="KV-Zusatzbeitrag (%)">
              <klar-input type="number" suffix="%" [ngModel]="kvZusatzbeitragStr()" (ngModelChange)="onZusatzStr($event)" />
            </klar-form-field>
          } @else {
            <klar-form-field label="PKV-Beitrag / Monat" for="bn-pkv">
              <klar-money-input inputId="bn-pkv" [(amountCents)]="pkvBeitragMonthlyCents" placeholder="0,00" />
            </klar-form-field>
          }
          <klar-form-field label="Rentenversicherung">
            <klar-select [(value)]="rentenversicherungRegion" [options]="rvRegionOptions" />
          </klar-form-field>
        </div>
      </section>

      <!-- ── Optional ───────────────────────────────────── -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Optional</span>
        </header>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
          <klar-form-field label="Geldwerter Vorteil / Monat" for="bn-gw">
            <klar-money-input inputId="bn-gw" [(amountCents)]="geldwerterVorteilMonthlyCents" placeholder="0,00" />
          </klar-form-field>
          <klar-form-field label="Lohnsteuer-Freibetrag / Jahr" for="bn-fb">
            <klar-money-input inputId="bn-fb" [(amountCents)]="lohnsteuerFreibetragYearlyCents" placeholder="0,00" />
          </klar-form-field>
        </div>
      </section>

      <!-- ── Ergebnis ───────────────────────────────────── -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Ergebnis</span>
          <klar-switch label="Jahreswerte" [(checked)]="showYearly" />
        </header>

        <div class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5 px-5 py-5 items-center">
          <klar-donut-chart
            [segments]="donutSegments()"
            [size]="160"
            [thickness]="28"
            [showLegend]="false"
            ariaLabel="Verteilung Netto Steuern Sozialabgaben"
          />
          <div class="flex flex-col gap-2 min-w-0">
            <div class="text-[10px] uppercase tracking-widest text-(--fg-3)">
              Netto · {{ showYearly() ? 'pro Jahr' : 'pro Monat' }}
            </div>
            <div class="font-mono text-(--success)"
                 style="font-family: var(--font-display); font-size: 32px; font-variant-numeric: tabular-nums; line-height: 1.05;">
              {{ display(result().monthly.nettoCents) | klarMoney }}
            </div>
            <ul class="flex flex-col gap-1 text-[12px] mt-2">
              @for (seg of donutSegments(); track seg.label) {
                <li class="flex items-center justify-between">
                  <span class="flex items-center gap-2 text-(--fg-1)">
                    <span class="inline-block w-2.5 h-2.5 rounded-sm" [style.background]="seg.color"></span>
                    {{ seg.label }}
                  </span>
                  <span class="font-mono text-(--fg-2)" style="font-variant-numeric: tabular-nums;">
                    {{ display(seg.value) | klarMoney }}
                  </span>
                </li>
              }
            </ul>
          </div>
        </div>

        <table class="w-full text-[13px] border-t border-(--line-soft)">
          <tbody>
            @for (row of breakdown(); track row.label) {
              <tr [class.border-b]="!row.divider"
                  [class.border-t]="row.divider === 'top'"
                  [class.border-(--line-soft)]="!row.divider"
                  [class.border-(--line)]="row.divider === 'top'"
                  [class.font-medium]="row.emphasize">
                <td class="px-5 py-2"
                    [class.text-(--fg-2)]="!row.emphasize"
                    [class.text-(--fg-1)]="row.emphasize">
                  {{ row.label }}
                </td>
                <td class="px-5 py-2 text-right font-mono"
                    [class.text-(--success)]="row.tone === 'positive'"
                    [class.text-(--danger)]="row.tone === 'negative'"
                    [class.text-(--fg-1)]="row.tone === 'neutral'"
                    style="font-variant-numeric: tabular-nums;">
                  {{ row.signPrefix }}{{ display(row.cents) | klarMoney }}
                </td>
              </tr>
            }
          </tbody>
        </table>

        <p class="px-5 py-3 text-[11px] text-(--fg-2) leading-relaxed border-t border-(--line-soft)">
          Berechnung mit 2026er Werten (§32a EStG, Sozialversicherungs-Rechengrößen-Verordnung 2026,
          PV 3,6 %, BBG-KV/PV 5.812,50 €, BBG-RV/AV 8.450 €). Soli-Freigrenze 20.350 €
          (40.700 € im Splittingverfahren). Richtgrößen, keine verbindliche Steuerauskunft.
        </p>
      </section>
    </div>
  `,
})
export class BruttoNettoPageComponent implements OnInit {
  private readonly pageHeader = inject(PageHeaderService);

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
  readonly kvZusatzbeitragPct               = signal<number>(2.9);
  readonly pkvBeitragMonthlyCents           = signal<number | null>(null);
  readonly rentenversicherungRegion         = signal<RentenversicherungRegion>('west');
  readonly geldwerterVorteilMonthlyCents    = signal<number | null>(0);
  readonly lohnsteuerFreibetragYearlyCents  = signal<number | null>(0);

  readonly showYearly = signal(false);

  // String views for the klar-input bridges (klar-input emits string).
  readonly birthYearStr        = computed(() => String(this.birthYear()));
  readonly kvZusatzbeitragStr  = computed(() => String(this.kvZusatzbeitragPct()));

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

  readonly breakdown = computed(() => {
    const m = this.result().monthly;
    return [
      { label: 'Brutto',                cents: m.bruttoCents,        tone: 'neutral'  as const, signPrefix: '',  emphasize: false, divider: null },
      { label: 'Lohnsteuer',            cents: m.lohnsteuerCents,    tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Solidaritätszuschlag',  cents: m.soliCents,          tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Kirchensteuer',         cents: m.kirchensteuerCents, tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Krankenversicherung',   cents: m.kvCents, tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Pflegeversicherung',    cents: m.pvCents, tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Rentenversicherung',    cents: m.rvCents, tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Arbeitslosenvers.',     cents: m.avCents, tone: 'negative' as const, signPrefix: '−', emphasize: false, divider: null },
      { label: 'Netto',                 cents: m.nettoCents, tone: 'positive' as const, signPrefix: '', emphasize: true, divider: 'top' as const },
    ];
  });

  display(monthlyCents: number): number {
    return this.showYearly() ? monthlyCents * 12 : monthlyCents;
  }

  onBirthYearStr(v: string): void {
    const n = parseInt(v, 10);
    if (!isNaN(n)) this.birthYear.set(n);
  }

  onZusatzStr(v: string): void {
    const n = parseFloat(v.replace(',', '.'));
    if (!isNaN(n)) this.kvZusatzbeitragPct.set(n);
  }

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Brutto-Netto-Rechner', subtitle: 'Tools' });
  }
}
