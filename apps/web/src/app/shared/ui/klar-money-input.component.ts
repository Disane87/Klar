import { Component, computed, effect, input, model, signal } from '@angular/core';
import { HlmInputDirective } from './hlm/hlm-input.directive';

/**
 * Money input that binds an integer cents value.
 *
 *   <klar-money-input [(amountCents)]="cents" placeholder="0,00" />
 *
 * Display layer is a DE-formatted decimal ("−50,00"). Input is parsed back to
 * cents with proper rounding (no float drift). Sign is allowed by default.
 */
@Component({
  selector: 'klar-money-input',
  standalone: true,
  imports: [HlmInputDirective],
  template: `
    <input
      hlmInput
      class="font-mono tabular-nums"
      type="text"
      inputmode="decimal"
      [attr.id]="inputId() ?? null"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [value]="display()"
      (input)="onInput($event)"
      (blur)="onBlur()"
    />
  `,
})
export class KlarMoneyInputComponent {
  readonly amountCents = model<number | null>(null);
  readonly placeholder = input('0,00');
  readonly inputId = input<string | null>(null);
  readonly disabled = input(false);
  readonly allowNegative = input(true);

  /** Internal display string. Kept separate from cents so the user can type
   *  intermediate values like `-` or `1,` without losing focus. */
  private readonly _display = signal('');

  protected readonly display = computed(() => this._display());

  constructor() {
    // External cents → display string (skip when user is currently typing
    // a value that already round-trips to the same cents).
    effect(() => {
      const cents = this.amountCents();
      const current = this._parseToCents(this._display());
      if (cents === current) return;
      this._display.set(cents === null ? '' : this._centsToDisplay(cents));
    });
  }

  onInput(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    this._display.set(raw);
    const parsed = this._parseToCents(raw);
    if (parsed === null) {
      this.amountCents.set(null);
      return;
    }
    if (!this.allowNegative() && parsed < 0) {
      this.amountCents.set(Math.abs(parsed));
      return;
    }
    this.amountCents.set(parsed);
  }

  onBlur(): void {
    // Reformat on blur if the parsed value is well-formed.
    const cents = this.amountCents();
    if (cents !== null) this._display.set(this._centsToDisplay(cents));
  }

  /** Parse "−50,00" / "-50.00" / "1.234,56" → integer cents, or null if empty
   *  or unparseable. Pure function suitable for unit testing. */
  protected _parseToCents(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === ',') return null;
    // Strip thousands separators ("1.234,56" → "1234,56", "1,234.56" → "1234.56").
    // Heuristic: if both `.` and `,` present, the LAST one is the decimal mark.
    let s = trimmed.replace(/[^0-9,.\-]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const decimalMark = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : null;
    if (decimalMark === ',') s = s.replace(/\./g, '').replace(',', '.');
    else if (decimalMark === '.') s = s.replace(/,/g, '');
    else s = s.replace(/[,.]/g, '');
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return Math.round(n * 100);
  }

  /** cents → "−50,00" (DE locale, two decimals) */
  protected _centsToDisplay(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const euros = Math.floor(abs / 100);
    const rest = abs % 100;
    return `${sign}${euros},${rest.toString().padStart(2, '0')}`;
  }
}
