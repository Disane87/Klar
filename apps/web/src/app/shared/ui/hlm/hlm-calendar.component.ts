import { Component, signal, computed, input, model, output } from '@angular/core';
import { KlarIconComponent } from '../../icons/klar-icon.component';
import { KlarMoneyPipe } from '../../pipes/klar-money.pipe';
import { CalendarLegendComponent } from '../calendar-legend.component';

export interface CalendarEvent {
  name: string;
  amountCents: number;
  color: string;
  isRecurring: boolean;
}

/** Day-number → event list (1-indexed, matches Date.getDate()) */
export type CalendarEventMap = Record<number, CalendarEvent[]>;

interface CalendarDay {
  date: Date;
  day: number;
  col: number; // 0=Mon … 6=Sun
  isOutside: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'hlm-calendar',
  standalone: true,
  imports: [KlarIconComponent, KlarMoneyPipe, CalendarLegendComponent],
  host: { class: 'flex flex-col h-full' },
  template: `
    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-(--border)">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
          TAGESANSICHT
        </span>
        <span class="text-[16px] font-semibold tracking-[-0.01em] text-(--text)">
          {{ title() }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Legend -->
        <div class="hidden md:flex mr-3">
          <klar-calendar-legend />
        </div>
        <!-- Nav buttons -->
        <button type="button" (click)="prev()"
                aria-label="Vorheriger Monat"
                class="flex size-9 items-center justify-center rounded-md
                       text-(--text-muted) transition-colors
                       hover:bg-(--surface-2) hover:text-(--text)
                       active:opacity-70">
          <klar-icon name="chevron-left" [size]="18" />
        </button>
        <button type="button" (click)="next()"
                aria-label="Nächster Monat"
                class="flex size-9 items-center justify-center rounded-md
                       text-(--text-muted) transition-colors
                       hover:bg-(--surface-2) hover:text-(--text)
                       active:opacity-70">
          <klar-icon name="chevron-right" [size]="18" />
        </button>
      </div>
    </div>

    <!-- ── Grid ─────────────────────────────────────────────────── -->
    <div class="flex-1 grid grid-cols-7 grid-rows-[auto_repeat(6,1fr)]">
      <!-- Weekday headers -->
      @for (wd of WEEKDAYS; track wd) {
        <div class="py-3 text-center text-[10px] font-semibold uppercase
                    tracking-[0.1em] text-(--text-muted)
                    border-b border-(--border)">
          {{ wd }}
        </div>
      }

      <!-- Day cells -->
      @for (day of days(); track day.date.getTime()) {
        <div class="relative border-b border-r border-(--border-subtle,var(--border))
                    nth-[7n]:border-r-0"
             [class]="dayCellClass(day)"
             (mouseenter)="!day.isOutside && hoveredDay.set(day.day)"
             (mouseleave)="hoveredDay.set(null)"
             (click)="!day.isOutside && selectDay(day.date)">

          <!-- Day number pill -->
          <div class="flex items-center justify-center"
               [class]="dayNumClass(day)">
            {{ day.day }}
          </div>

          <!-- Events (only for current-month days) -->
          @if (!day.isOutside) {
            <!-- Desktop: recurring chips + transaction dots -->
            <div class="hidden md:block">
              @for (ev of recurringEvents(day.day).slice(0, 3); track $index) {
                <div class="mt-1 mx-1 rounded px-2 py-1 text-[10px]
                            font-medium leading-tight truncate border-l-2"
                     [style.background]="ev.color + '22'"
                     [style.borderLeftColor]="ev.color"
                     [style.color]="ev.color">
                  {{ ev.name }}
                </div>
              }
              @if (recurringEvents(day.day).length > 3) {
                <div class="mt-1 mx-1 rounded px-2 py-1 text-[9px]
                            font-medium text-(--text-muted) bg-(--surface-2)">
                  +{{ recurringEvents(day.day).length - 3 }} weitere
                </div>
              }
              @let txs = txDots(day.day);
              @if (txs.length) {
                <div class="flex flex-wrap gap-1 mt-1.5 px-1.5">
                  @for (dot of txs; track dot.color) {
                    <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          [style.background]="dot.color"></span>
                  }
                </div>
              }
            </div>
            <!-- Mobile: all events as dots -->
            <div class="md:hidden flex flex-wrap justify-center gap-1 mt-1 px-0.5">
              @for (dot of dotSummary(day.day); track dot.color) {
                <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      [style.background]="dot.color"></span>
              }
            </div>
          }

          <!-- Hover card — desktop only -->
          @if (hoveredDay() === day.day && !day.isOutside) {
            @let evts = dayEvents(day.day);
            @if (evts.length) {
              <div class="hidden md:block absolute z-50 min-w-56 max-w-64
                          rounded-md border border-(--border)
                          bg-(--surface) shadow-[0_4px_20px_rgba(0,0,0,0.35)]
                          p-3 pointer-events-none"
                   [class]="hcPosition(day)">

                <!-- Date label -->
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-widest
                            text-(--text-muted) border-b border-(--border) pb-2">
                  {{ day.day }}. {{ monthShort() }}
                </div>

                <!-- Event rows -->
                @for (ev of evts; track $index) {
                  <div class="flex items-center gap-2 py-1">
                    <span class="w-2 h-2 rounded-full shrink-0"
                          [style.background]="ev.color"></span>
                    <span class="flex-1 min-w-0 text-[12px] text-(--text-2) truncate">
                      {{ ev.name }}
                    </span>
                    <span class="font-mono tabular-nums text-[12px] shrink-0 ml-1"
                          [style.color]="ev.amountCents >= 0 ? 'var(--color-income)' : 'var(--color-expense)'">
                      {{ ev.amountCents | klarMoney }}
                    </span>
                  </div>
                }

                <!-- Daily total (if multiple events) -->
                @if (evts.length > 1) {
                  @let total = evts.reduce(sumAmounts, 0);
                  <div class="flex items-center justify-between mt-2 pt-2
                              border-t border-(--border)
                              text-[11px] font-semibold uppercase tracking-[0.08em]">
                    <span class="text-(--text-muted)">GESAMT</span>
                    <span class="font-mono tabular-nums"
                          [style.color]="total >= 0 ? 'var(--color-income)' : 'var(--color-expense)'">
                      {{ total | klarMoney }}
                    </span>
                  </div>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class HlmCalendarComponent {
  protected readonly WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  month  = input<string>();
  date   = model<Date | undefined>(undefined);
  events = input<CalendarEventMap>({});

  monthChange = output<string>();
  dayTap      = output<{ date: Date; events: CalendarEvent[] }>();

  protected readonly hoveredDay = signal<number | null>(null);

  protected readonly title = computed(() =>
    new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
      .format(this._focusedMonth()),
  );

  protected readonly monthShort = computed(() =>
    new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(this._focusedMonth()),
  );

  private readonly _focusedMonth = computed(() => {
    const m = this.month();
    if (m) {
      const [y, mo] = m.split('-');
      return new Date(Number(y), Number(mo) - 1, 1);
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  protected readonly days = computed<CalendarDay[]>(() => {
    const focused  = this._focusedMonth();
    const year     = focused.getFullYear();
    const month    = focused.getMonth();
    const today    = new Date();
    const selected = this.date();

    const firstDow      = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth   = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: CalendarDay[] = [];

    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push(this._cell(new Date(year, month - 1, prevMonthDays - i), true, today, selected));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(this._cell(new Date(year, month, d), false, today, selected));
    }
    let next = 1;
    while (cells.length < 42) {
      cells.push(this._cell(new Date(year, month + 1, next++), true, today, selected));
    }
    return cells;
  });

  protected dayEvents(day: number): CalendarEvent[] {
    return this.events()[day] ?? [];
  }

  protected recurringEvents(day: number): CalendarEvent[] {
    return this.dayEvents(day).filter(e => e.isRecurring);
  }

  /** Deduped color dots for non-recurring transactions (max 4) */
  protected txDots(day: number): { color: string }[] {
    const evts = this.dayEvents(day).filter(e => !e.isRecurring);
    const seen = new Set<string>();
    const result: { color: string }[] = [];
    for (const ev of evts) {
      if (!seen.has(ev.color) && result.length < 4) {
        seen.add(ev.color);
        result.push({ color: ev.color });
      }
    }
    return result;
  }

  /** @deprecated kept for hover card (all events) */
  protected dotSummary(day: number): { color: string }[] {
    const evts = this.dayEvents(day);
    const seen = new Set<string>();
    const result: { color: string }[] = [];
    for (const ev of evts) {
      if (!seen.has(ev.color) && result.length < 4) {
        seen.add(ev.color);
        result.push({ color: ev.color });
      }
    }
    return result;
  }

  protected dayCellClass(day: CalendarDay): string {
    const base = 'p-2 cursor-pointer transition-colors duration-100 ';
    if (day.isOutside) return base + 'opacity-25 cursor-default ';
    if (day.isToday)   return base + 'bg-[color-mix(in_oklab,var(--color-surplus)_10%,var(--surface))] ';
    return base + 'hover:bg-(--surface-2) ';
  }

  protected dayNumClass(day: CalendarDay): string {
    const base = 'mx-auto w-7 h-7 text-[12px] font-mono tabular-nums rounded-full ';
    if (day.isSelected) return base + 'bg-[var(--color-accent)] text-[var(--zinc-950)] font-bold ';
    if (day.isToday)    return base + 'bg-[var(--color-surplus)] text-[var(--zinc-950)] font-bold ';
    return base + 'text-[var(--text-2)] font-medium ';
  }

  /** Position hover card below the cell, aligned left/right based on column */
  protected hcPosition(day: CalendarDay): string {
    const hAlign = day.col >= 4 ? 'right-0' : 'left-0';
    return `top-full mt-1 ${hAlign}`;
  }

  protected readonly sumAmounts = (acc: number, ev: CalendarEvent) => acc + ev.amountCents;

  private _cell(date: Date, isOutside: boolean, today: Date, sel: Date | undefined): CalendarDay {
    return {
      date,
      day:        date.getDate(),
      col:        (date.getDay() + 6) % 7,
      isOutside,
      isToday:    this._sameDay(date, today),
      isSelected: !!sel && this._sameDay(date, sel),
    };
  }

  private _sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  protected selectDay(d: Date) {
    this.date.set(d);
    this.dayTap.emit({ date: d, events: this.dayEvents(d.getDate()) });
  }

  protected prev() {
    const f = this._focusedMonth();
    this.monthChange.emit(this._ym(new Date(f.getFullYear(), f.getMonth() - 1, 1)));
  }

  protected next() {
    const f = this._focusedMonth();
    this.monthChange.emit(this._ym(new Date(f.getFullYear(), f.getMonth() + 1, 1)));
  }

  private _ym(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
