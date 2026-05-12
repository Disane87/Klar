import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  calculateNet,
  splitNetByPositions,
  KRANKENKASSEN_2026,
  KRANKENKASSE_MANUAL_ID,
  type Bundesland,
  type GrossToNetInput,
  type Krankenversicherung,
  type PayrollCalculatorState,
  type PayrollPosition,
  type RentenversicherungRegion,
  type Steuerklasse,
} from '@klar/shared';
import { PayrollCalculatorStateService } from '../../../core/user/payroll-calculator-state.service';
import { KlarTileComponent } from '../../../shared/ui/klar-tile.component';
import { KlarFormFieldComponent } from '../../../shared/ui/klar-form-field.component';
import { KlarInputComponent } from '../../../shared/ui/klar-input.component';
import { KlarMoneyInputComponent } from '../../../shared/ui/klar-money-input.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../../shared/ui/klar-select.component';
import { KlarSwitchComponent } from '../../../shared/ui/klar-switch.component';
import { KlarButtonComponent } from '../../../shared/ui/klar-button.component';
import { KlarDonutChartComponent, type DonutSegment } from '../../../shared/ui/klar-donut-chart.component';
import { KlarMoneyPipe } from '../../../shared/pipes/klar-money.pipe';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../../shared/ui/klar-toast.service';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { PageHeaderService } from '../../../core/page-header/page-header.service';
import {
  RecurringCreateDialogComponent,
  type PrefillSplit,
} from '../../fixkosten/recurring-create-dialog.component';

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

const KK_OPTIONS: KlarSelectOption[] = [
  ...KRANKENKASSEN_2026.map(kk => ({
    value: kk.id,
    label: `${kk.name} — ${kk.zusatzbeitragPct.toFixed(2).replace('.', ',')} %`,
  })),
  { value: KRANKENKASSE_MANUAL_ID, label: 'Andere — manueller Zusatzbeitrag' },
];

let _positionId = 0;
const newPositionId = () => `pos-${Date.now()}-${++_positionId}`;

@Component({
  selector: 'klar-brutto-netto-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden' },
  styleUrl: './brutto-netto.component.css',
  imports: [
    FormsModule,
    KlarTileComponent,
    KlarFormFieldComponent,
    KlarInputComponent,
    KlarMoneyInputComponent,
    KlarSelectComponent,
    KlarSwitchComponent,
    KlarButtonComponent,
    KlarDonutChartComponent,
    KlarMoneyPipe,
  ],
  template: `
    <div class="page">

      <!-- ── Summary tiles ───────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-(--s-3)">
        <klar-tile
          label="Brutto / Monat"
          [value]="(result().monthly.bruttoCents | klarMoney) ?? ''"
          [sub]="(result().yearly.bruttoCents | klarMoney) + ' / Jahr'"
        />
        <klar-tile
          label="Netto / Monat"
          tone="success"
          valueClass="text-(--success)"
          [value]="(result().monthly.nettoCents | klarMoney) ?? ''"
          [sub]="(result().yearly.nettoCents | klarMoney) + ' / Jahr'"
        />
        <klar-tile
          label="Abzüge / Monat"
          [value]="(deductionsCents() | klarMoney) ?? ''"
          [sub]="(deductionsYearlyCents() | klarMoney) + ' / Jahr'"
        />
        <klar-tile
          label="Effektive Steuerlast"
          [value]="formatPct(effectiveTaxRate())"
          [sub]="'auf Brutto'"
        />
        <klar-tile
          label="Sozialabgaben-Quote"
          [value]="formatPct(effectiveSocialRate())"
          [sub]="'auf Brutto'"
        />
      </div>

      <!-- ── Action bar ───────────────────────────────────────── -->
      <div class="flex items-center justify-between gap-3">
        <span class="text-[11px] text-(--fg-3)" aria-live="polite">
          @if (saving()) { Speichere … }
          @else if (savedAt()) { Gespeichert }
        </span>
        <klar-button
          tone="primary"
          icon="plus"
          [disabled]="!canTransfer()"
          (click)="transferToFixkosten()"
        >
          In Fixkosten übernehmen
        </klar-button>
      </div>

      <!-- ── Two-column workspace ────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-(--s-4) items-start">

        <!-- ── Left: form ─────────────────────────────────────── -->
        <div class="flex flex-col gap-(--s-4) min-w-0">

          <!-- ── Gehaltsbestandteile ─────────────────────────── -->
          <div>
            <div class="section-head"><span>Gehaltsbestandteile</span></div>
            <div class="card">
              <div class="px-(--s-3) pt-(--s-3) pb-(--s-2)">
                <klar-form-field label="Zeitraum">
                  <klar-select [(value)]="period" [options]="periodOptions" />
                </klar-form-field>
              </div>

              @for (pos of positions(); track pos.id; let i = $index) {
                <div class="row" style="grid-template-columns: 1.4fr auto 32px; gap: var(--s-2); padding: var(--s-2) var(--s-3);">
                  <klar-input
                    placeholder="Position (z. B. Festgehalt, Provision)"
                    [ngModel]="pos.label"
                    (ngModelChange)="updatePosition(i, { label: $event })"
                  />
                  <klar-money-input
                    placeholder="0,00"
                    [amountCents]="pos.amountCents"
                    (amountCentsChange)="updatePosition(i, { amountCents: $event ?? 0 })"
                  />
                  <klar-button
                    tone="danger"
                    size="sm"
                    icon="trash"
                    [disabled]="positions().length <= 1"
                    (click)="removePosition(i)"
                  ></klar-button>
                </div>
              }

              <div class="row" style="grid-template-columns: 1fr auto; padding: var(--s-2) var(--s-3);">
                <klar-button tone="ghost" icon="plus" (click)="addPosition()">
                  Position hinzufügen
                </klar-button>
                <span class="text-[11px] uppercase tracking-widest text-(--fg-3)">
                  Σ Brutto / {{ periodLabelShort() }}
                  <span class="ml-2 font-mono text-(--fg-1)" style="font-variant-numeric: tabular-nums;">
                    {{ totalGrossCents() | klarMoney }}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <!-- ── Steuer ──────────────────────────────────────── -->
          <div>
            <div class="section-head"><span>Steuer</span></div>
            <div class="card">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-(--s-3)">
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
              <div class="px-(--s-3) pb-(--s-3)">
                <klar-switch
                  label="Kirchensteuer"
                  description="9 % vom LSt-Betrag (8 % in Bayern und Baden-Württemberg)."
                  [(checked)]="kirchensteuer"
                />
              </div>
            </div>
          </div>

          <!-- ── Sozialversicherung ──────────────────────────── -->
          <div>
            <div class="section-head"><span>Sozialversicherung</span></div>
            <div class="card">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-(--s-3)">
                <klar-form-field label="Krankenversicherung">
                  <klar-select [(value)]="krankenversicherung" [options]="kvOptions" />
                </klar-form-field>
                @if (krankenversicherung() === 'gesetzlich') {
                  <klar-form-field label="Krankenkasse">
                    <klar-select [(value)]="krankenkasseId" [options]="kkOptions" (valueChange)="onKkSelected($event)" />
                  </klar-form-field>
                  <klar-form-field label="KV-Zusatzbeitrag (%)">
                    <klar-input type="number" suffix="%"
                                [ngModel]="kvZusatzbeitragStr()"
                                (ngModelChange)="onZusatzStr($event)" />
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
            </div>
          </div>

          <!-- ── Optional ────────────────────────────────────── -->
          <div>
            <div class="section-head"><span>Optional</span></div>
            <div class="card">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-(--s-3)">
                <klar-form-field label="Geldwerter Vorteil / Monat" for="bn-gw">
                  <klar-money-input inputId="bn-gw" [(amountCents)]="geldwerterVorteilMonthlyCents" placeholder="0,00" />
                </klar-form-field>
                <klar-form-field label="Lohnsteuer-Freibetrag / Jahr" for="bn-fb">
                  <klar-money-input inputId="bn-fb" [(amountCents)]="lohnsteuerFreibetragYearlyCents" placeholder="0,00" />
                </klar-form-field>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Right: results ─────────────────────────────────── -->
        <div class="flex flex-col gap-(--s-4) min-w-0 lg:sticky lg:top-(--s-4)">

          <!-- ── Aufschlüsselung ─────────────────────────────── -->
          <div>
            <div class="section-head"><span>Aufschlüsselung</span></div>
            <div class="card">
              <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-(--s-3) p-(--s-3) items-center">
                <klar-donut-chart
                  [segments]="donutSegments()"
                  [size]="160"
                  [thickness]="28"
                  [showLegend]="false"
                  ariaLabel="Verteilung Netto Steuern Sozialabgaben"
                />
                <ul class="flex flex-col gap-1.5 text-[13px] min-w-0">
                  @for (seg of donutSegments(); track seg.label) {
                    <li class="flex items-center justify-between gap-3">
                      <span class="flex items-center gap-2 text-(--fg-1)">
                        <span class="inline-block w-2.5 h-2.5 rounded-sm" [style.background]="seg.color"></span>
                        {{ seg.label }}
                      </span>
                      <span class="font-mono text-(--fg-2)" style="font-variant-numeric: tabular-nums;">
                        {{ seg.value | klarMoney }}
                      </span>
                    </li>
                  }
                </ul>
              </div>

              <div class="row text-[11px] uppercase tracking-widest text-(--fg-3)"
                   style="grid-template-columns: 1fr 110px 110px; padding: var(--s-1) var(--s-3);">
                <span>Posten</span>
                <span class="text-right">/ Monat</span>
                <span class="text-right">/ Jahr</span>
              </div>
              @for (row of breakdown(); track row.label) {
                <div class="row" [class.subtotal]="row.emphasize"
                     style="grid-template-columns: 1fr 110px 110px; padding: var(--s-1) var(--s-3);">
                  <span class="name">{{ row.label }}</span>
                  <span class="amt mono text-right"
                        [class.pos]="row.tone === 'positive'"
                        [class.text-(--danger)]="row.tone === 'negative'">
                    {{ row.signPrefix }}{{ row.monthlyCents | klarMoney }}
                  </span>
                  <span class="amt mono text-right"
                        [class.pos]="row.tone === 'positive'"
                        [class.text-(--danger)]="row.tone === 'negative'">
                    {{ row.signPrefix }}{{ row.yearlyCents | klarMoney }}
                  </span>
                </div>
              }
            </div>
          </div>

          <!-- ── Netto pro Position ─────────────────────────── -->
          @if (netSplits().length > 1) {
            <div>
              <div class="section-head"><span>Netto pro Position</span></div>
              <div class="card">
                @for (split of netSplits(); track split.position.id) {
                  <div class="row" style="padding: var(--s-2) var(--s-3);">
                    <div class="lhs">
                      <span class="name">{{ split.position.label || 'Ohne Bezeichnung' }}</span>
                      <span class="meta">
                        Brutto <span class="mono">{{ split.position.amountCents | klarMoney }}</span>
                      </span>
                    </div>
                    <span class="amt mono pos">{{ split.nettoMonthlyCents | klarMoney }}</span>
                  </div>
                }
                <div class="row subtotal" style="padding: var(--s-2) var(--s-3);">
                  <div class="lhs"><span class="name">Gesamt Netto</span></div>
                  <span class="amt mono pos">{{ result().monthly.nettoCents | klarMoney }}</span>
                </div>
              </div>
            </div>
          }

          <p class="text-[11px] text-(--fg-2) leading-relaxed">
            Berechnung mit 2026er Werten (§32a EStG, Sozialversicherungs-Rechengrößen-Verordnung 2026,
            PV 3,6 %, BBG-KV/PV 5.812,50 €, BBG-RV/AV 8.450 €). Soli-Freigrenze 20.350 €
            (40.700 € im Splittingverfahren). Krankenkassen-Zusatzbeiträge werden jährlich aktualisiert.
            Richtgrößen, keine verbindliche Steuerauskunft.
          </p>
        </div>

      </div>
    </div>
  `,
})
export class BruttoNettoPageComponent implements OnInit {
  private readonly pageHeader = inject(PageHeaderService);
  private readonly dialog     = inject(KlarDialogService);
  private readonly toast      = inject(KlarToastService);
  private readonly persistence = inject(PayrollCalculatorStateService);
  protected readonly cats     = inject(CategoriesStore);

  protected readonly steuerklasseOptions = STEUERKLASSE_OPTIONS;
  protected readonly bundeslandOptions   = BUNDESLAND_OPTIONS;
  protected readonly kvOptions           = KV_OPTIONS;
  protected readonly rvRegionOptions     = RV_REGION_OPTIONS;
  protected readonly periodOptions       = PERIOD_OPTIONS;
  protected readonly kinderOptions       = KINDER_OPTIONS;
  protected readonly kkOptions           = KK_OPTIONS;

  // ── Positions ────────────────────────────────────────────────
  readonly positions = signal<PayrollPosition[]>([
    { id: newPositionId(), label: 'Festgehalt', amountCents: 400000 },
  ]);

  readonly period                           = signal<'monthly' | 'yearly'>('monthly');
  readonly steuerklasse                     = signal<string>('1');
  readonly bundesland                       = signal<string>('NW');
  readonly kirchensteuer                    = signal(false);
  readonly birthYear                        = signal<number>(1990);
  readonly kinderStr                        = signal<string>('0');
  readonly krankenversicherung              = signal<Krankenversicherung>('gesetzlich');
  readonly krankenkasseId                   = signal<string>('tk');
  readonly kvZusatzbeitragPct               = signal<number>(2.69); // TK 2026 default
  readonly pkvBeitragMonthlyCents           = signal<number | null>(null);
  readonly rentenversicherungRegion         = signal<RentenversicherungRegion>('west');
  readonly geldwerterVorteilMonthlyCents    = signal<number | null>(0);
  readonly lohnsteuerFreibetragYearlyCents  = signal<number | null>(0);

  // Persistence UX flags
  readonly hydrated = signal(false);
  readonly saving   = signal(false);
  readonly savedAt  = signal<number | null>(null);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSerialized: string | null = null;

  readonly birthYearStr        = computed(() => String(this.birthYear()));
  readonly kvZusatzbeitragStr  = computed(() => String(this.kvZusatzbeitragPct()));
  readonly periodLabelShort    = computed(() => this.period() === 'monthly' ? 'Monat' : 'Jahr');

  readonly totalGrossCents = computed(() =>
    this.positions().reduce((s, p) => s + p.amountCents, 0),
  );

  readonly input = computed<GrossToNetInput>(() => ({
    grossCents:                       this.totalGrossCents(),
    positions:                        this.positions(),
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

  readonly result    = computed(() => calculateNet(this.input()));
  readonly netSplits = computed(() => splitNetByPositions(this.input(), this.result()));

  readonly deductionsCents = computed(() => {
    const m = this.result().monthly;
    return m.steuernCents + m.sozialabgabenCents;
  });

  readonly deductionsYearlyCents = computed(() => {
    const y = this.result().yearly;
    return y.steuernCents + y.sozialabgabenCents;
  });

  readonly effectiveTaxRate = computed(() => {
    const m = this.result().monthly;
    return m.bruttoCents > 0 ? m.steuernCents / m.bruttoCents : 0;
  });

  readonly effectiveSocialRate = computed(() => {
    const m = this.result().monthly;
    return m.bruttoCents > 0 ? m.sozialabgabenCents / m.bruttoCents : 0;
  });

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
    const y = this.result().yearly;
    return [
      { label: 'Brutto',                monthlyCents: m.bruttoCents,        yearlyCents: y.bruttoCents,        tone: 'neutral'  as const, signPrefix: '',  emphasize: false },
      { label: 'Lohnsteuer',            monthlyCents: m.lohnsteuerCents,    yearlyCents: y.lohnsteuerCents,    tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Solidaritätszuschlag',  monthlyCents: m.soliCents,          yearlyCents: y.soliCents,          tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Kirchensteuer',         monthlyCents: m.kirchensteuerCents, yearlyCents: y.kirchensteuerCents, tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Krankenversicherung',   monthlyCents: m.kvCents,            yearlyCents: y.kvCents,            tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Pflegeversicherung',    monthlyCents: m.pvCents,            yearlyCents: y.pvCents,            tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Rentenversicherung',    monthlyCents: m.rvCents,            yearlyCents: y.rvCents,            tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Arbeitslosenvers.',     monthlyCents: m.avCents,            yearlyCents: y.avCents,            tone: 'negative' as const, signPrefix: '−', emphasize: false },
      { label: 'Netto',                 monthlyCents: m.nettoCents,         yearlyCents: y.nettoCents,         tone: 'positive' as const, signPrefix: '',  emphasize: true  },
    ];
  });

  readonly canTransfer = computed(() => this.result().monthly.nettoCents > 0);

  /** Formats a 0..1 ratio as a German-locale percentage with one decimal. */
  formatPct(ratio: number): string {
    if (!Number.isFinite(ratio) || ratio <= 0) return '0,0 %';
    return `${(ratio * 100).toFixed(1).replace('.', ',')} %`;
  }

  addPosition(): void {
    const next = this.positions().length === 1 ? 'Provision' : 'Position ' + (this.positions().length + 1);
    this.positions.update(arr => [...arr, { id: newPositionId(), label: next, amountCents: 0 }]);
  }

  removePosition(index: number): void {
    if (this.positions().length <= 1) return;
    this.positions.update(arr => arr.filter((_, i) => i !== index));
  }

  updatePosition(index: number, patch: Partial<PayrollPosition>): void {
    this.positions.update(arr => arr.map((p, i) => i === index ? { ...p, ...patch } : p));
  }

  onBirthYearStr(v: string): void {
    const n = parseInt(v, 10);
    if (!isNaN(n)) this.birthYear.set(n);
  }

  onZusatzStr(v: string): void {
    const n = parseFloat(v.replace(',', '.'));
    if (!isNaN(n)) this.kvZusatzbeitragPct.set(n);
    // User edited manually — flip the KK select to "manuell".
    if (this.krankenkasseId() !== KRANKENKASSE_MANUAL_ID) {
      this.krankenkasseId.set(KRANKENKASSE_MANUAL_ID);
    }
  }

  onKkSelected(id: string): void {
    if (id === KRANKENKASSE_MANUAL_ID) return; // keep current Zusatzbeitrag
    const kk = KRANKENKASSEN_2026.find(k => k.id === id);
    if (kk) this.kvZusatzbeitragPct.set(kk.zusatzbeitragPct);
  }

  /**
   * Open the recurring-create dialog, pre-filled with name/amount/payroll
   * snapshot, plus a split row per Lohnzettel-position (each carrying its
   * proportional share of the monthly net).
   */
  transferToFixkosten(): void {
    if (!this.canTransfer()) return;
    if (this.period() === 'yearly') {
      this.toast.error('Zeitraum auf "pro Monat" stellen, dann übernehmen.');
      return;
    }

    // 1:1 mapping of the calculator's "Netto pro Position" rows — same
    // labels the user sees, no synthetic suffix, no length-guard. A single
    // position still gets one split so the resulting Fixkosten entry
    // documents what the amount stands for.
    const splits: PrefillSplit[] = this.netSplits().map(s => ({
      label:       s.position.label?.trim() || 'Position',
      amountCents: s.nettoMonthlyCents,
    }));

    const incomeCategory = this.cats.active().find(c =>
      c.type === 'FIXED_INCOME' || c.type === 'INCOME' || c.type === 'VARIABLE_INCOME',
    ) ?? null;

    const positionsLabel = this.positions().map(p => p.label).filter(Boolean).join(' + ');
    const name = positionsLabel || 'Gehalt';

    this.dialog.open({
      title:     'Gehalt als Fixkosten anlegen',
      component: RecurringCreateDialogComponent,
      width:     'lg',
      inputs: {
        prefillName:         name,
        prefillAmountCents:  this.result().monthly.nettoCents,
        prefillCategoryId:   incomeCategory?.id ?? null,
        prefillFrequency:    'MONTHLY',
        prefillPayrollInput: this.input(),
        prefillSplits:       splits.length > 0 ? splits : null,
      },
    });
  }

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Gehaltsrechner', subtitle: 'Tools' });
    void this.hydrate();
  }

  /** Load the saved snapshot (if any) and apply it to the form signals. */
  private async hydrate(): Promise<void> {
    try {
      const saved = await this.persistence.load();
      if (saved) {
        if (saved.positions && saved.positions.length > 0) {
          this.positions.set(saved.positions.map(p => ({
            id: p.id ?? newPositionId(),
            label: p.label ?? '',
            amountCents: p.amountCents ?? 0,
          })));
        }
        if (saved.period)                          this.period.set(saved.period);
        if (saved.steuerklasse !== undefined)      this.steuerklasse.set(String(saved.steuerklasse));
        if (saved.bundesland)                      this.bundesland.set(saved.bundesland);
        if (saved.kirchensteuer !== undefined)     this.kirchensteuer.set(saved.kirchensteuer);
        if (saved.birthYear !== undefined)         this.birthYear.set(saved.birthYear);
        if (saved.kinderfreibetraege !== undefined) this.kinderStr.set(String(saved.kinderfreibetraege));
        if (saved.krankenversicherung)             this.krankenversicherung.set(saved.krankenversicherung);
        if (saved.krankenkasseId)                  this.krankenkasseId.set(saved.krankenkasseId);
        if (saved.kvZusatzbeitragPct !== undefined) this.kvZusatzbeitragPct.set(saved.kvZusatzbeitragPct);
        if (saved.pkvBeitragMonthlyCents !== undefined) this.pkvBeitragMonthlyCents.set(saved.pkvBeitragMonthlyCents);
        if (saved.rentenversicherungRegion)        this.rentenversicherungRegion.set(saved.rentenversicherungRegion);
        if (saved.geldwerterVorteilMonthlyCents !== undefined) this.geldwerterVorteilMonthlyCents.set(saved.geldwerterVorteilMonthlyCents);
        if (saved.lohnsteuerFreibetragYearlyCents !== undefined) this.lohnsteuerFreibetragYearlyCents.set(saved.lohnsteuerFreibetragYearlyCents);
      }
      // Snapshot the post-hydrate state so the change-effect does not
      // immediately PUT the just-loaded values back to the server.
      this.lastSerialized = JSON.stringify(this.snapshot());
    } finally {
      this.hydrated.set(true);
    }
  }

  /** Build a serializable snapshot of all persisted form fields. */
  private snapshot(): PayrollCalculatorState {
    return {
      positions:                       this.positions(),
      period:                          this.period(),
      steuerklasse:                    parseInt(this.steuerklasse(), 10) as Steuerklasse,
      bundesland:                      this.bundesland() as Bundesland,
      kirchensteuer:                   this.kirchensteuer(),
      birthYear:                       this.birthYear(),
      kinderfreibetraege:              parseFloat(this.kinderStr()),
      krankenversicherung:             this.krankenversicherung(),
      krankenkasseId:                  this.krankenkasseId(),
      kvZusatzbeitragPct:              this.kvZusatzbeitragPct(),
      pkvBeitragMonthlyCents:          this.pkvBeitragMonthlyCents(),
      rentenversicherungRegion:        this.rentenversicherungRegion(),
      geldwerterVorteilMonthlyCents:   this.geldwerterVorteilMonthlyCents(),
      lohnsteuerFreibetragYearlyCents: this.lohnsteuerFreibetragYearlyCents(),
    };
  }

  // Watches every persisted signal and PUTs the snapshot 500ms after the
  // last change. Skips the first cycle until `hydrated` flips true so the
  // initial defaults are not written over a freshly loaded snapshot.
  private readonly persistEffect = effect(() => {
    const snap = this.snapshot();
    if (!this.hydrated()) return;
    const serialized = JSON.stringify(snap);
    if (serialized === this.lastSerialized) return;
    this.lastSerialized = serialized;
    untracked(() => this.queueSave(snap));
  });

  private queueSave(state: PayrollCalculatorState): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saving.set(true);
      this.persistence
        .save(state)
        .then(() => this.savedAt.set(Date.now()))
        .catch(() => { /* silent — non-critical, retry on next edit */ })
        .finally(() => this.saving.set(false));
    }, 500);
  }
}
