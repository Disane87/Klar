import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

type CalloutTone = 'info' | 'accent' | 'warn' | 'danger';

/**
 * Subtle inset callout used inside CRUD dialogs — info hint above a Create
 * form, diff summary below an Edit form, bulk-action target above a Move,
 * etc. Renders a left icon (overridable via `[icon]`), bold label slot
 * `<span lead>`, and free-form content.
 *
 *   <klar-dialog-callout tone="info" icon="info">
 *     Wird ab dem nächsten Monat erwartet.
 *   </klar-dialog-callout>
 *
 *   <klar-dialog-callout tone="accent">
 *     <span lead>1 Änderung:</span> Betrag −1.180 € → −1.220 €.
 *   </klar-dialog-callout>
 */
@Component({
  selector: 'klar-dialog-callout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarIconComponent],
  host: { '[class]': '_cls()' },
  template: `
    @if (icon()) {
      <klar-icon [name]="icon()!" [size]="14" [class]="_iconCls()" />
    }
    <div class="text-[12px] leading-snug text-(--text-2) [&>[lead]]:font-medium [&>[lead]]:text-(--text)">
      <ng-content />
    </div>
  `,
})
export class KlarDialogCalloutComponent {
  readonly tone = input<CalloutTone>('info');
  readonly icon = input<string | null>(null);

  protected readonly _cls = computed(() => {
    const base = 'flex items-start gap-2.5 px-3 py-2.5 rounded-md border';
    switch (this.tone()) {
      case 'accent':
        return `${base} border-(--accent)/40 bg-(--accent)/10`;
      case 'warn':
        return `${base} border-(--color-warn)/40 bg-(--color-warn)/10`;
      case 'danger':
        return `${base} border-(--color-expense)/40 bg-(--color-expense)/10`;
      default:
        return `${base} border-(--border) bg-(--surface-2)`;
    }
  });

  protected readonly _iconCls = computed(() => {
    const base = 'shrink-0 mt-0.5';
    switch (this.tone()) {
      case 'accent':
        return `${base} text-(--accent)`;
      case 'warn':
        return `${base} text-(--color-warn)`;
      case 'danger':
        return `${base} text-(--color-expense)`;
      default:
        return `${base} text-(--accent)`;
    }
  });
}
