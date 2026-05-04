import { Component, model } from '@angular/core';

export const COLOR_SWATCHES = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#64748b', '#f8fafc',
];

@Component({
  selector: 'klar-color-picker',
  standalone: true,
  template: `
    <div class="flex items-center gap-2 flex-wrap">
      <button type="button"
              class="w-7 h-7 rounded-full border-2 bg-(--surface-2) flex items-center justify-center transition-all"
              [class.border-(--color-accent)]="value() === null"
              [class.border-(--border)]="value() !== null"
              (click)="value.set(null)"
              title="Automatisch (Markenfarbe)">
        <span class="text-[9px] text-(--text-muted) font-semibold leading-none select-none">Auto</span>
      </button>
      @for (swatch of swatches; track swatch) {
        <button type="button"
                class="w-7 h-7 rounded-full border-2 transition-all"
                [class.border-(--color-accent)]="value() === swatch"
                [class.border-transparent]="value() !== swatch"
                [style.background]="swatch"
                (click)="value.set(value() === swatch ? null : swatch)"
                [title]="swatch">
          <span class="sr-only">{{ swatch }}</span>
        </button>
      }
    </div>
  `,
})
export class KlarColorPickerComponent {
  value = model<string | null>(null);
  readonly swatches = COLOR_SWATCHES;
}
