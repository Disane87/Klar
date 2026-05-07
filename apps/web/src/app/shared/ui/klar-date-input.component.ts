import { Component, computed, input, model } from '@angular/core';
import { HlmInputDirective } from './hlm/hlm-input.directive';

/**
 * Date input that two-way binds an ISO date string ("YYYY-MM-DD" or "").
 * Wraps `<input type="date">` with hlmInput, 44px touch target, and consistent
 * Safari-safe behavior. Centralises the boilerplate that 5+ dialogs duplicate.
 *
 *   <klar-date-input [(value)]="startDate" min="2026-01-01" />
 *
 * Once `Temporal.PlainDate` is project-wide (CLAUDE.md), the API will switch
 * over without callers changing — but today every consumer holds ISO strings
 * already, so this stays string-based.
 */
@Component({
  selector: 'klar-date-input',
  standalone: true,
  imports: [HlmInputDirective],
  template: `
    <input
      hlmInput
      type="date"
      class="min-h-11"
      [attr.id]="inputId() ?? null"
      [disabled]="disabled()"
      [value]="iso()"
      [attr.min]="min() || null"
      [attr.max]="max() || null"
      (input)="onInput($event)"
      (change)="onInput($event)"
    />
  `,
})
export class KlarDateInputComponent {
  /** Two-way bound ISO date string ("YYYY-MM-DD") or empty string. */
  readonly value = model<string>('');
  readonly min = input<string>('');
  readonly max = input<string>('');
  readonly inputId = input<string | null>(null);
  readonly disabled = input(false);

  protected readonly iso = computed(() => this.value() ?? '');

  onInput(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    this.value.set(raw);
  }
}
