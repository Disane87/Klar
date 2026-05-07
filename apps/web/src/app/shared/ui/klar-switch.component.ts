import { Component, computed, input, model } from '@angular/core';
import { HlmSwitchComponent } from './hlm/hlm-switch.component';

let _id = 0;

/**
 * Switch with label & optional helper text, sitting on top of `hlm-switch`.
 *
 *   <klar-switch [(checked)]="active" label="Planspiel aktiv"
 *                description="Berücksichtigt geplante Posten in der Übersicht." />
 */
@Component({
  selector: 'klar-switch',
  standalone: true,
  imports: [HlmSwitchComponent],
  template: `
    <label
      [attr.for]="_id"
      class="flex items-start gap-3 cursor-pointer min-h-[44px] py-1"
      [class.opacity-50]="disabled()"
      [class.cursor-not-allowed]="disabled()"
    >
      <span class="flex-1 min-w-0">
        @if (label()) {
          <span class="block text-sm font-medium text-foreground">{{ label() }}</span>
        }
        @if (description()) {
          <span class="block text-xs text-muted-foreground mt-0.5">{{ description() }}</span>
        }
      </span>
      <hlm-switch
        class="mt-1"
        [(checked)]="checked"
        [disabled]="disabled()"
        [ariaLabel]="ariaLabel() ?? label()"
      />
    </label>
  `,
})
export class KlarSwitchComponent {
  readonly checked = model(false);
  readonly label = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);

  protected readonly _id = computed(() => `klar-switch-${++_id}`);
}
