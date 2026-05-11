import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { KlarChartTooltipComponent } from './klar-chart-tooltip.component';

export interface CashflowBarsInput {
  /** ISO YYYY-MM-DD per booking */
  date: string;
  amountCents: number;
}

interface DayBar {
  day: number;
  iso: string;
  incomeCents: number;
  expenseCents: number;
}

interface HoverState {
  day: number;
  /** container-local px */
  x: number;
  y: number;
}

/**
 * Daily income/expense bars for a single month. Income = positive bar above
 * the baseline, expense = negative bar below. Pure SVG, dark-mode safe via
 * CSS vars. Hover reveals a Spartan-style tooltip card with the day total.
 */
@Component({
  selector: 'klar-chart-cashflow-bars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarChartTooltipComponent],
  host: { class: 'block w-full' },
  template: `
    @if (bars().length === 0) {
      <div class="px-5 py-6 text-center text-[12px] text-(--fg-2)">
        Keine Buchungen in diesem Monat.
      </div>
    } @else {
      <div class="relative px-4 pt-3 pb-4">
        <svg
          [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH"
          class="block w-full h-auto"
          preserveAspectRatio="none"
          (pointerleave)="hover.set(null)"
        >
          <!-- baseline -->
          <line
            [attr.x1]="padX"
            [attr.x2]="viewW - padX"
            [attr.y1]="midY()"
            [attr.y2]="midY()"
            stroke="var(--line)"
            stroke-width="1"
          />
          @for (b of bars(); track b.day) {
            @if (b.incomeCents > 0) {
              <rect
                [attr.x]="barX(b.day)"
                [attr.y]="midY() - barH(b.incomeCents)"
                [attr.width]="barW()"
                [attr.height]="barH(b.incomeCents)"
                fill="var(--success)"
                rx="1"
                [attr.opacity]="hover()?.day === b.day || hover() === null ? 1 : 0.45"
              />
            }
            @if (b.expenseCents < 0) {
              <rect
                [attr.x]="barX(b.day)"
                [attr.y]="midY()"
                [attr.width]="barW()"
                [attr.height]="barH(-b.expenseCents)"
                fill="var(--danger)"
                rx="1"
                [attr.opacity]="hover()?.day === b.day || hover() === null ? 0.85 : 0.35"
              />
            }
            <!-- transparent hit target spanning the full column height -->
            <rect
              [attr.x]="barX(b.day) - barW() * 0.2"
              y="0"
              [attr.width]="barW() * 1.4"
              [attr.height]="viewH"
              fill="transparent"
              style="pointer-events: all; cursor: crosshair;"
              (pointerenter)="onEnter($event, b)"
              (pointermove)="onEnter($event, b)"
            />
          }
          <!-- hover highlight rail -->
          @if (hover(); as h) {
            <line
              [attr.x1]="barX(h.day) + barW() / 2"
              [attr.x2]="barX(h.day) + barW() / 2"
              [attr.y1]="padY"
              [attr.y2]="viewH - padY"
              stroke="var(--accent)"
              stroke-width="1"
              stroke-dasharray="2 2"
              opacity="0.6"
              pointer-events="none"
            />
          }
          <!-- weekday markers (every 7th) -->
          @for (b of weekMarkers(); track b.day) {
            <text
              [attr.x]="barX(b.day) + barW() / 2"
              [attr.y]="viewH - 4"
              text-anchor="middle"
              font-size="9"
              fill="var(--fg-3)"
              style="font-family: var(--font-mono); font-variant-numeric: tabular-nums;"
            >{{ b.day }}</text>
          }
        </svg>

        @if (hover(); as h) {
          <klar-chart-tooltip
            [x]="h.x"
            [y]="h.y"
            [title]="hoverTitle(h.day)"
            [body]="hoverBody(h.day)"
          />
        }
      </div>
    }
  `,
})
export class KlarChartCashflowBarsComponent {
  /** All bookings of the active month. */
  readonly items = input<CashflowBarsInput[]>([]);
  /** YYYY-MM string used to compute the day-count for the X scale. */
  readonly month = input.required<string>();

  protected readonly viewW = 360;
  protected readonly viewH = 140;
  protected readonly padX = 8;
  protected readonly padY = 12;

  protected readonly hover = signal<HoverState | null>(null);

  protected readonly daysInMonth = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    if (!y || !m) return 31;
    return new Date(y, m, 0).getDate();
  });

  /**
   * Cap visible bars at "today" when the active month is the current month —
   * future days stay empty so the chart never claims data that hasn't
   * happened yet. Past/future months render the entire span.
   */
  protected readonly visibleDays = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    const total = this.daysInMonth();
    if (!y || !m) return total;
    const now = new Date();
    if (now.getFullYear() === y && now.getMonth() + 1 === m) {
      return Math.min(total, now.getDate());
    }
    return total;
  });

  protected readonly bars = computed<DayBar[]>(() => {
    const visible = this.visibleDays();
    const acc = new Map<number, DayBar>();
    for (let d = 1; d <= visible; d++) {
      acc.set(d, { day: d, iso: '', incomeCents: 0, expenseCents: 0 });
    }
    for (const t of this.items()) {
      const day = Number(t.date.slice(8, 10));
      if (!day || day > visible) continue;
      const row = acc.get(day);
      if (!row) continue;
      if (t.amountCents > 0) row.incomeCents += t.amountCents;
      else row.expenseCents += t.amountCents;
    }
    return [...acc.values()];
  });

  protected readonly weekMarkers = computed<DayBar[]>(() =>
    this.bars().filter(b => b.day === 1 || b.day % 7 === 0),
  );

  protected readonly maxAbs = computed(() => {
    let max = 1;
    for (const b of this.bars()) {
      max = Math.max(max, b.incomeCents, -b.expenseCents);
    }
    return max;
  });

  midY(): number {
    return (this.viewH - this.padY * 2) / 2 + this.padY;
  }

  barX(day: number): number {
    const innerW = this.viewW - this.padX * 2;
    const slot = innerW / this.daysInMonth();
    return this.padX + (day - 1) * slot + slot * 0.15;
  }

  barW(): number {
    const innerW = this.viewW - this.padX * 2;
    const slot = innerW / this.daysInMonth();
    return Math.max(1, slot * 0.7);
  }

  barH(absCents: number): number {
    const half = (this.viewH - this.padY * 2) / 2;
    return Math.max(0, (absCents / this.maxAbs()) * half);
  }

  protected onEnter(ev: PointerEvent, b: DayBar): void {
    this.hover.set({ day: b.day, x: ev.clientX, y: ev.clientY });
  }

  protected hoverTitle(day: number): string {
    const [y, m] = this.month().split('-').map(Number);
    if (!y || !m) return `Tag ${day}`;
    return new Date(y, m - 1, day).toLocaleDateString('de-DE', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
    });
  }

  protected hoverBody(day: number): string {
    const b = this.bars().find(x => x.day === day);
    if (!b) return '';
    const fmt = (cents: number) =>
      `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    const lines: string[] = [];
    if (b.incomeCents > 0)  lines.push(`Einnahmen: ${fmt(b.incomeCents)}`);
    if (b.expenseCents < 0) lines.push(`Ausgaben: ${fmt(-b.expenseCents)}`);
    if (b.incomeCents === 0 && b.expenseCents === 0) lines.push('Keine Buchungen');
    return lines.join('\n');
  }
}
