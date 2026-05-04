import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-list-row',
  standalone: true,
  imports: [NgClass, KlarIconComponent],
  host: { class: 'block border-b border-(--border)/40 last:border-b-0' },
  template: `
    <div class="flex items-center gap-3 px-6 py-2.5 min-h-11 transition-colors"
         [attr.role]="navigable() ? 'button' : null"
         [attr.tabindex]="navigable() ? '0' : null"
         [class.opacity-40]="disabled()"
         [class.pointer-events-none]="disabled()"
         [ngClass]="navigable()
           ? (danger()
              ? 'cursor-pointer hover:bg-(--color-expense)/6 active:bg-(--color-expense)/10'
              : 'cursor-pointer hover:bg-(--surface-2)/60 active:bg-(--surface-2)')
           : ''"
         (click)="navigable() && rowClick.emit()"
         (keydown.enter)="navigable() && rowClick.emit()"
         (keydown.space)="navigable() && rowClick.emit()">
      <ng-content />
      @if (navigable()) {
        <klar-icon name="chevron-right" [size]="14" class="shrink-0 text-(--text-muted)" />
      }
    </div>
  `,
})
export class KlarListRowComponent {
  navigable = input(false);
  danger    = input(false);
  disabled  = input(false);

  rowClick = output<void>();
}
