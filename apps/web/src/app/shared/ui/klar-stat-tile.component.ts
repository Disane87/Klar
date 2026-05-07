import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

export type KlarStatTileTone = 'neutral' | 'ok' | 'warn' | 'danger';

const TONE_BORDER: Record<KlarStatTileTone, string> = {
  neutral: 'border-(--line-soft)',
  ok:      'border-[oklch(from_var(--success)_l_c_h/0.30)]',
  warn:    'border-[oklch(from_var(--warn)_l_c_h/0.30)]',
  danger:  'border-[oklch(from_var(--danger)_l_c_h/0.30)]',
};

const TONE_DECOR: Record<KlarStatTileTone, string> = {
  neutral: 'bg-[oklch(from_var(--accent)_l_c_h/0.10)]',
  ok:      'bg-[oklch(from_var(--success)_l_c_h/0.10)]',
  warn:    'bg-[oklch(from_var(--warn)_l_c_h/0.10)]',
  danger:  'bg-[oklch(from_var(--danger)_l_c_h/0.10)]',
};

const TONE_LABEL: Record<KlarStatTileTone, string> = {
  neutral: 'text-(--fg-2)',
  ok:      'text-(--success)',
  warn:    'text-(--warn)',
  danger:  'text-(--danger)',
};

@Component({
  selector: 'klar-stat-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarIconComponent],
  host: { class: 'block' },
  template: `
    <div [class]="tileClass()">
      <span [class]="labelClass()">
        @if (icon()) {
          <klar-icon [name]="icon()!" [size]="11" />
        }
        <span>{{ label() }}</span>
      </span>
      <span class="
        font-medium text-[24px] leading-[1.1] tracking-[-0.02em]
        text-(--fg)
        [font-family:var(--font-display)]
        [font-variant-numeric:tabular-nums]
      ">{{ value() }}</span>
      @if (delta()) {
        <span class="text-[11px] text-(--fg-2) mt-0.5">{{ delta() }}</span>
      }
      <span aria-hidden="true"
            [class]="decorClass()"></span>
    </div>
  `,
})
export class KlarStatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<string | null>(null);
  readonly tone  = input<KlarStatTileTone>('neutral');
  readonly icon  = input<string | null>(null);

  protected readonly tileClass = computed(() => [
    'relative overflow-hidden flex flex-col gap-1',
    'px-4 py-3.5 rounded-(--r-8) bg-(--bg-1)',
    'border',
    TONE_BORDER[this.tone()],
  ].join(' '));

  protected readonly labelClass = computed(() => [
    'inline-flex items-center gap-1.5',
    'text-[10px] uppercase tracking-[0.14em]',
    TONE_LABEL[this.tone()],
  ].join(' '));

  protected readonly decorClass = computed(() => [
    'pointer-events-none absolute -right-2.5 -bottom-2.5',
    'size-20 rounded-full',
    TONE_DECOR[this.tone()],
  ].join(' '));
}
