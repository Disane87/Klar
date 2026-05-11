import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { KlarChartTooltipComponent } from './klar-chart-tooltip.component';

export interface WeekdayInput {
  date: string;
  amountCents: number;
}

interface WeekdayCell {
  /** 0=Mo .. 6=So */
  idx: number;
  label: string;
  /** Absolute spend (positive). */
  expenseCents: number;
  /** 0..1 intensity vs. peak day. */
  intensity: number;
  count: number;
}

interface HoverState {
  idx: number;
  x: number;
  y: number;
}

const LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const LONG_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/**
 * Aggregates spend per weekday (Mo–So) and renders a 7-cell intensity strip.
 * Hover highlights the active cell and reveals a Spartan-style tooltip card.
 */
@Component({
  selector: 'klar-chart-weekday-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarChartTooltipComponent],
  host: { class: 'block w-full' },
  template: `
    @if (peak() === 0) {
      <div class="px-5 py-6 text-center text-[12px] text-(--fg-2)">
        Keine Ausgaben in diesem Monat.
      </div>
    } @else {
      <div class="relative px-4 py-4 grid grid-cols-7 gap-2">
        @for (c of cells(); track c.idx) {
          <div
            class="flex flex-col items-center gap-1 cursor-crosshair"
            (pointerenter)="onEnter($event, c)"
            (pointermove)="onEnter($event, c)"
            (pointerleave)="hover.set(null)"
          >
            <div
              class="w-full rounded-md transition-all"
              [style.background]="cellColor(c.intensity)"
              [style.height.px]="cellHeight(c.intensity)"
              [class.ring-2]="hover()?.idx === c.idx"
              [class.ring-\(--accent\)]="hover()?.idx === c.idx"
              [style.opacity]="hover() === null || hover()?.idx === c.idx ? 1 : 0.55"
            ></div>
            <span class="text-[10px] uppercase tracking-widest text-(--fg-3)">{{ c.label }}</span>
            <span class="text-[11px] mono text-(--fg)">{{ formatEuro(c.expenseCents) }}</span>
          </div>
        }

        @if (hover(); as h) {
          <klar-chart-tooltip
            [x]="h.x"
            [y]="h.y"
            [title]="hoverTitle(h.idx)"
            [body]="hoverBody(h.idx)"
          />
        }
      </div>
    }
  `,
})
export class KlarChartWeekdayHeatmapComponent {
  readonly items = input<WeekdayInput[]>([]);

  protected readonly hover = signal<HoverState | null>(null);

  protected readonly cells = computed<WeekdayCell[]>(() => {
    const totals = new Array(7).fill(0).map((_, i) => ({
      idx: i,
      label: LABELS[i],
      expenseCents: 0,
      count: 0,
      intensity: 0,
    }));
    for (const t of this.items()) {
      if (t.amountCents >= 0) continue;
      const [y, m, d] = t.date.split('-').map(Number);
      if (!y || !m || !d) continue;
      const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mo=0..So=6
      totals[wd].expenseCents += -t.amountCents;
      totals[wd].count += 1;
    }
    const peak = Math.max(1, ...totals.map(t => t.expenseCents));
    return totals.map(t => ({ ...t, intensity: t.expenseCents / peak }));
  });

  protected readonly peak = computed(() =>
    this.cells().reduce((s, c) => s + c.expenseCents, 0),
  );

  protected cellHeight(intensity: number): number {
    return Math.max(8, Math.round(8 + intensity * 56));
  }

  protected cellColor(intensity: number): string {
    if (intensity === 0) return 'var(--line-soft)';
    const pct = Math.max(15, Math.round(intensity * 100));
    return `color-mix(in oklab, var(--danger) ${pct}%, var(--line-soft))`;
  }

  protected formatEuro(cents: number): string {
    if (cents === 0) return '—';
    const eur = Math.round(cents / 100);
    if (eur >= 1000) return `${(Math.round(eur / 100) / 10).toString()}k`;
    return `${eur}`;
  }

  protected onEnter(ev: PointerEvent, c: WeekdayCell): void {
    this.hover.set({ idx: c.idx, x: ev.clientX, y: ev.clientY });
  }

  protected hoverTitle(idx: number): string {
    return LONG_LABELS[idx] ?? '';
  }

  protected hoverBody(idx: number): string {
    const c = this.cells().find(x => x.idx === idx);
    if (!c) return '';
    const eur = `${(c.expenseCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    return `Ausgaben: ${eur}\n${c.count} ${c.count === 1 ? 'Buchung' : 'Buchungen'}`;
  }
}
