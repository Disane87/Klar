import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

export type KlarTileTone = 'neutral' | 'success' | 'warn' | 'danger';

const TONE_BORDER: Record<KlarTileTone, string> = {
  neutral: 'border-(--line-soft)',
  success: 'border-[oklch(from_var(--success)_l_c_h/0.30)]',
  warn:    'border-[oklch(from_var(--warn)_l_c_h/0.30)]',
  danger:  'border-[oklch(from_var(--danger)_l_c_h/0.30)]',
};

const TONE_DECOR: Record<KlarTileTone, string> = {
  // Soft tone-tinted glow for the bottom-right corner blob (low opacity by design).
  neutral: 'bg-[oklch(from_var(--accent)_l_c_h/0.15)]',
  success: 'bg-[oklch(from_var(--success)_l_c_h/0.15)]',
  warn:    'bg-[oklch(from_var(--warn)_l_c_h/0.15)]',
  danger:  'bg-[oklch(from_var(--danger)_l_c_h/0.15)]',
};

const TONE_LABEL: Record<KlarTileTone, string> = {
  neutral: 'text-(--fg-2)',
  success: 'text-(--success)',
  warn:    'text-(--warn)',
  danger:  'text-(--danger)',
};

/**
 * Canonical Klar summary tile.
 *
 * Visual language: rounded box with a subtle corner blob in the lower-right,
 * tone-tinted border + label, Fraunces hero value, optional sub-line that is
 * hidden on mobile.
 *
 * Tone meanings:
 *   neutral = info / status quo
 *   success = positive (income, surplus, healthy)
 *   warn    = attention (over budget, deadline approaching)
 *   danger  = negative (deficit, breach, error)
 *
 * For tiles that need to color the VALUE (not just the label) — e.g.
 * the Buchungen Bilanz that wants green for surplus and red for deficit —
 * pass `valueClass="text-(--success)"` (or `text-(--danger)`).
 */
@Component({
  selector: 'klar-tile',
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
        <span class="truncate">{{ label() }}</span>
      </span>
      <span [class]="valueWrapperClass()">
        <ng-content select="[slot=value]">{{ value() }}</ng-content>
      </span>
      @if (sub() || hasSubSlot) {
        <span class="hidden md:flex text-[11px] text-(--fg-2) items-center gap-1.5 mt-0.5 truncate font-(family-name:--font-mono)">
          <ng-content select="[slot=sub]">{{ sub() }}</ng-content>
        </span>
      }
      <span aria-hidden="true" [class]="decorClass()"></span>
    </div>
  `,
})
export class KlarTileComponent {
  readonly label      = input.required<string>();
  readonly value      = input<string>('');
  readonly sub        = input<string | null>(null);
  readonly tone       = input<KlarTileTone>('neutral');
  readonly icon       = input<string | null>(null);
  readonly valueClass = input<string>('');

  protected readonly hasSubSlot = false;

  protected readonly tileClass = computed(() => [
    'relative overflow-hidden flex flex-col gap-1 md:gap-1.5',
    'px-3 py-2.5 md:px-4 md:py-3.5 rounded-(--r-8) bg-(--bg-1)',
    'border',
    TONE_BORDER[this.tone()],
  ].join(' '));

  protected readonly labelClass = computed(() => [
    'inline-flex items-center gap-1 md:gap-1.5',
    'text-[9px] md:text-[10px] uppercase tracking-[0.14em] font-medium',
    TONE_LABEL[this.tone()],
  ].join(' '));

  protected readonly valueWrapperClass = computed(() => [
    'font-medium text-[18px] md:text-[24px] leading-[1.1] tracking-[-0.02em]',
    'truncate font-(family-name:--font-display) [font-variant-numeric:tabular-nums]',
    this.valueClass() || 'text-(--fg)',
  ].join(' '));

  protected readonly decorClass = computed(() => [
    // Tone-tinted corner blob in the bottom-right — purely decorative.
    'pointer-events-none absolute -right-3 -bottom-3',
    'size-12 rounded-full',
    TONE_DECOR[this.tone()],
  ].join(' '));
}
