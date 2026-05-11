import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  calculateNet,
  type Bundesland,
  type GrossToNetInput,
  type Krankenversicherung,
  type RentenversicherungRegion,
  type Steuerklasse,
} from '@klar/shared';
import { KlarHeroComponent } from '../../../shared/ui/klar-hero.component';
import { KlarMoneyInputComponent } from '../../../shared/ui/klar-money-input.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../../shared/ui/klar-select.component';
import { KlarSwitchComponent } from '../../../shared/ui/klar-switch.component';
import { KlarDonutChartComponent, type DonutSegment } from '../../../shared/ui/klar-donut-chart.component';
import { KlarMoneyPipe } from '../../../shared/pipes/klar-money.pipe';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../../shared/ui/hlm/hlm-label.directive';
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
    KlarHeroComponent,
    KlarMoneyInputComponent,
    KlarSelectComponent,
    KlarSwitchComponent,
    KlarDonutChartComponent,
    KlarMoneyPipe,
    HlmInputDirective,
    HlmLabelDirective,
  ],
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-y-auto p-(--s-4) gap-(--s-5)' },
  template: `
    <klar-hero
      eyebrow="Tools"
      title="Brutto-Netto-Rechner"
      sub="Geben Sie Ihr Brutto-Gehalt ein und sehen Sie sofort, was netto übrig bleibt — inklusive Lohnsteuer, Soli, Kirchensteuer und Sozialabgaben."
    />

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-(--s-5)">
      <!-- ── Form ─────────────────────────────────────────────── -->
      <section class="rounded-(--r-8) border border-(--line) bg-(--bg-1) p-(--s-5) flex flex-col gap-(--s-4)">
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-(--s-3)">
          <div class="flex flex-col gap-1">
            <label hlmLabel for="bn-brutto">Brutto</label>
            <klar-money-input inputId="bn-brutto" [(amountCents)]="grossCents" placeholder="0,00" />
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
            <label hlmLabel for="bn-birth">Geburtsjahr</label>
            <input hlmInput id="bn-birth" type="number" min="1900" max="2030"
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
              <label hlmLabel for="bn-kvz">KV-Zusatzbeitrag (%)</label>
              <input hlmInput id="bn-kvz" type="number" min="0" max="10" step="0.1"
                     [value]="kvZusatzbeitragPct()" (input)="onZusatz($event)" />
            </div>
          } @else {
            <div class="flex flex-col gap-1">
              <label hlmLabel for="bn-pkv">PKV-Beitrag / Monat</label>
              <klar-money-input inputId="bn-pkv" [(amountCents)]="pkvBeitragMonthlyCents" placeholder="0,00" />
            </div>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-(--s-3) items-end">
          <div class="flex flex-col gap-1">
            <label hlmLabel>Rentenversicherung</label>
            <klar-select [(value)]="rentenversicherungRegion" [options]="rvRegionOptions" />
          </div>
          <div class="flex flex-col gap-1">
            <label hlmLabel for="bn-gw">Geldwerter Vorteil / Monat</label>
            <klar-money-input inputId="bn-gw" [(amountCents)]="geldwerterVorteilMonthlyCents" placeholder="0,00" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label hlmLabel for="bn-fb">Lohnsteuer-Freibetrag / Jahr (ELStAM)</label>
          <klar-money-input inputId="bn-fb" [(amountCents)]="lohnsteuerFreibetragYearlyCents" placeholder="0,00" />
        </div>
      </section>

      <!-- ── Result ───────────────────────────────────────────── -->
      <section class="rounded-(--r-8) border border-(--line) bg-(--bg-1) p-(--s-5) flex flex-col gap-(--s-4)">
        <div class="flex items-baseline justify-between gap-3">
          <div>
            <div class="text-[10px] uppercase tracking-widest text-(--fg-3)">Netto</div>
            <div class="font-mono text-(--success)"
                 style="font-family: var(--font-display); font-size: 32px; font-variant-numeric: tabular-nums; line-height: 1.1;">
              {{ result().monthly.nettoCents | klarMoney }}
            </div>
            <div class="text-[12px] text-(--fg-3) mt-1">
              {{ showYearly() ? 'pro Jahr' : 'pro Monat' }}
              · jährlich {{ result().yearly.nettoCents | klarMoney }}
            </div>
          </div>
          <klar-switch label="Jahreswerte" [(checked)]="showYearly" />
        </div>

        <div class="flex justify-center">
          <klar-donut-chart
            [segments]="donutSegments()"
            [size]="180"
            [thickness]="32"
            ariaLabel="Verteilung Netto · Steuern · Sozialabgaben"
          />
        </div>

        <table class="w-full text-[13px]">
          <tbody class="[&_td]:py-1.5 [&_td]:px-2">
            <tr class="border-b border-(--line-soft)">
              <td class="text-(--fg-2)">Brutto</td>
              <td class="text-right font-mono text-(--fg-1)" style="font-variant-numeric: tabular-nums;">
                {{ display(result().monthly.bruttoCents) | klarMoney }}
              </td>
            </tr>
            <tr>
              <td class="text-(--fg-2)">Lohnsteuer</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.lohnsteuerCents) | klarMoney }}
              </td>
            </tr>
            <tr>
              <td class="text-(--fg-2)">Solidaritätszuschlag</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.soliCents) | klarMoney }}
              </td>
            </tr>
            <tr>
              <td class="text-(--fg-2)">Kirchensteuer</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.kirchensteuerCents) | klarMoney }}
              </td>
            </tr>
            <tr class="border-t border-(--line-soft)">
              <td class="text-(--fg-2)">Krankenversicherung</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.kvCents) | klarMoney }}
              </td>
            </tr>
            <tr>
              <td class="text-(--fg-2)">Pflegeversicherung</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.pvCents) | klarMoney }}
              </td>
            </tr>
            <tr>
              <td class="text-(--fg-2)">Rentenversicherung</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.rvCents) | klarMoney }}
              </td>
            </tr>
            <tr>
              <td class="text-(--fg-2)">Arbeitslosenversicherung</td>
              <td class="text-right font-mono text-(--danger)" style="font-variant-numeric: tabular-nums;">
                −{{ display(result().monthly.avCents) | klarMoney }}
              </td>
            </tr>
            <tr class="border-t border-(--line) font-medium">
              <td class="text-(--fg-1)">Netto</td>
              <td class="text-right font-mono text-(--success)" style="font-variant-numeric: tabular-nums;">
                {{ display(result().monthly.nettoCents) | klarMoney }}
              </td>
            </tr>
          </tbody>
        </table>

        <p class="text-[11px] text-(--fg-3) leading-[1.55]">
          Berechnung nach §32a EStG mit Standard-Pauschalen. Werte sind Richtgrößen,
          keine verbindliche Steuerauskunft. Aktuelle BMF-Tabellenwerte: 2025 (2026 folgt).
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

  // ── Form signals ─────────────────────────────────────────────
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

  readonly showYearly = signal(false);

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

  display(monthlyCents: number): number {
    return this.showYearly() ? monthlyCents * 12 : monthlyCents;
  }

  onBirthYear(e: Event): void {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.birthYear.set(v);
  }

  onZusatz(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.kvZusatzbeitragPct.set(v);
  }

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Brutto-Netto-Rechner', subtitle: 'Tools' });
  }
}
