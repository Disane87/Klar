import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';

export type ScopeId = string;

export interface ScopeOption {
  id: ScopeId;
  label: string;
}

/**
 * Scope-segmented control (Klar Design Pearl). Pill group with optional
 * presets — used for the page-header date scope picker
 * (Mai 2026 / Schnitt 6 M / Jahr) but generic enough to drive any
 * single-select segmented field.
 */
@Component({
  selector: 'klar-scope-segment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <div class="segmented" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (opt of options(); track opt.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="opt.id === value()"
          [class.active]="opt.id === value()"
          (click)="value.set(opt.id)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
})
export class KlarScopeSegmentComponent {
  readonly options = input.required<ScopeOption[]>();
  readonly value = model<ScopeId>('');
  readonly ariaLabel = input<string>('Zeitraum');
}
