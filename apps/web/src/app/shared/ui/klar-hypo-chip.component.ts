import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * "HYPOTHETISCH" chip for Planspiel projections (Klar Design Pearl).
 * Small uppercase amber-tinted pill that signals a value is a what-if
 * projection and not persisted state. Wraps the global .hypo-chip
 * utility for use in Angular templates.
 */
@Component({
  selector: 'klar-hypo-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `<span class="hypo-chip" [attr.aria-label]="ariaLabel()">{{ label() }}</span>`,
})
export class KlarHypoChipComponent {
  readonly label = input<string>('Hypothetisch');
  readonly ariaLabel = input<string>(
    'Diese Werte sind hypothetisch und werden nicht gespeichert',
  );
}
