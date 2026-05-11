import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { KlarChartTooltipComponent } from './klar-chart-tooltip.component';

export interface CumulativeInput {
  date: string;
  amountCents: number;
}

interface Point {
  day: number;
  x: number;
  y: number;
  cents: number;
}

interface HoverState {
  day: number;
  /** container-local px */
  x: number;
  y: number;
}

/**
 * Cumulative running balance over the month — for the current month we stop
 * at today (no fake data for future days). Renders an area + line chart.
 * Hover over any day reveals a Spartan-style tooltip card with the running
 * balance for that date plus a vertical guide line.
 */
@Component({
  selector: 'klar-chart-cumulative',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarChartTooltipComponent],
  host: { class: 'block w-full' },
  template: `
    @if (points().length <= 1) {
      <div class="px-5 py-6 text-center text-[12px] text-(--fg-2)">
        Noch nicht genug Daten für einen Verlauf.
      </div>
    } @else {
      <div class="relative px-4 pt-3 pb-4">
        <svg
          [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH"
          class="block w-full h-auto"
          preserveAspectRatio="none"
          (pointerleave)="hover.set(null)"
        >
          <defs>
            <linearGradient id="klarCumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="endColor()" stop-opacity="0.35" />
              <stop offset="100%" [attr.stop-color]="endColor()" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- zero baseline -->
          <line
            [attr.x1]="padX"
            [attr.x2]="viewW - padX"
            [attr.y1]="zeroY()"
            [attr.y2]="zeroY()"
            stroke="var(--line)"
            stroke-width="1"
            stroke-dasharray="2 2"
          />

          <!-- filled area -->
          <path [attr.d]="areaPath()" [attr.fill]="'url(#klarCumGrad)'" />
          <!-- line -->
          <path
            [attr.d]="linePath()"
            fill="none"
            [attr.stroke]="endColor()"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <!-- hover guide + active dot -->
          @if (hoveredPoint(); as hp) {
            <line
              [attr.x1]="hp.x"
              [attr.x2]="hp.x"
              [attr.y1]="padY"
              [attr.y2]="viewH - padY"
              stroke="var(--accent)"
              stroke-width="1"
              stroke-dasharray="2 2"
              opacity="0.6"
              pointer-events="none"
            />
            <circle
              [attr.cx]="hp.x"
              [attr.cy]="hp.y"
              r="5"
              fill="var(--bg-1)"
              [attr.stroke]="endColor()"
              stroke-width="2"
              pointer-events="none"
            />
          }

          <!-- end dot -->
          @if (lastPoint(); as lp) {
            @if (hover() === null) {
              <circle [attr.cx]="lp.x" [attr.cy]="lp.y" r="3" [attr.fill]="endColor()" />
            }
          }

          <!-- per-day hit areas (transparent) -->
          @for (p of points(); track p.day) {
            <circle
              [attr.cx]="p.x"
              [attr.cy]="p.y"
              r="10"
              fill="transparent"
              style="pointer-events: all; cursor: crosshair;"
              (pointerenter)="onEnter($event, p)"
              (pointermove)="onEnter($event, p)"
            />
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
export class KlarChartCumulativeComponent {
  readonly items = input<CumulativeInput[]>([]);
  readonly month = input.required<string>();

  protected readonly viewW = 360;
  protected readonly viewH = 140;
  protected readonly padX = 8;
  protected readonly padY = 14;

  protected readonly hover = signal<HoverState | null>(null);

  protected readonly daysInMonth = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    if (!y || !m) return 31;
    return new Date(y, m, 0).getDate();
  });

  /**
   * For the current month, cut the visible run-up at today — past/future
   * months render the entire span.
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

  protected readonly daily = computed<number[]>(() => {
    const visible = this.visibleDays();
    const arr = new Array<number>(visible + 1).fill(0);
    for (const t of this.items()) {
      const day = Number(t.date.slice(8, 10));
      if (day >= 1 && day <= visible) arr[day] += t.amountCents;
    }
    return arr;
  });

  protected readonly cumulative = computed<number[]>(() => {
    const arr = this.daily().slice();
    for (let i = 1; i < arr.length; i++) arr[i] += arr[i - 1];
    return arr;
  });

  protected readonly bounds = computed(() => {
    const cum = this.cumulative();
    let min = 0;
    let max = 0;
    for (const v of cum) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === max) max = min + 1;
    return { min, max };
  });

  protected readonly points = computed<Point[]>(() => {
    const cum = this.cumulative();
    const visible = this.visibleDays();
    // X-axis stays scaled to the full month so the line gets shorter as the
    // month progresses — gives a real-time "we're only at day 10/31" feel.
    const fullDays = this.daysInMonth();
    const innerW = this.viewW - this.padX * 2;
    const out: Point[] = [];
    for (let d = 0; d <= visible; d++) {
      const x = this.padX + (d / fullDays) * innerW;
      const y = this.toY(cum[d]);
      out.push({ day: d, x, y, cents: cum[d] });
    }
    return out;
  });

  protected readonly lastPoint = computed(() => this.points().at(-1));

  protected readonly hoveredPoint = computed<Point | null>(() => {
    const h = this.hover();
    if (!h) return null;
    return this.points().find(p => p.day === h.day) ?? null;
  });

  protected readonly endColor = computed(() => {
    const lp = this.lastPoint();
    if (!lp) return 'var(--accent)';
    return lp.cents >= 0 ? 'var(--success)' : 'var(--danger)';
  });

  protected linePath(): string {
    return this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }

  protected areaPath(): string {
    const pts = this.points();
    if (pts.length === 0) return '';
    const top = this.linePath();
    const last = pts[pts.length - 1];
    const first = pts[0];
    const baseY = this.zeroY();
    return `${top} L${last.x.toFixed(1)} ${baseY.toFixed(1)} L${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  }

  protected zeroY(): number {
    return this.toY(0);
  }

  protected onEnter(ev: PointerEvent, p: Point): void {
    this.hover.set({ day: p.day, x: ev.clientX, y: ev.clientY });
  }

  protected hoverTitle(day: number): string {
    const [y, m] = this.month().split('-').map(Number);
    if (!y || !m || day < 1) return 'Monatsstart';
    return new Date(y, m - 1, day).toLocaleDateString('de-DE', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
    });
  }

  protected hoverBody(day: number): string {
    const p = this.points().find(x => x.day === day);
    if (!p) return '';
    const fmt = `${(p.cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    return `Saldo: ${fmt}`;
  }

  private toY(value: number): number {
    const { min, max } = this.bounds();
    const span = Math.max(1, max - min);
    const innerH = this.viewH - this.padY * 2;
    return this.padY + (1 - (value - min) / span) * innerH;
  }
}
