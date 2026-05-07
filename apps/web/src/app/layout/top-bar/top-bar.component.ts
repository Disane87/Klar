import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarNotificationBellComponent } from '../notification-bell/notification-bell.component';
import type { PageStat } from '../../core/page-header/page-header.service';

@Component({
  selector: 'klar-top-bar',
  standalone: true,
  host: { class: 'block w-full' },
  imports: [
    NgClass,
    KlarButtonComponent,
    KlarHeaderUserComponent,
    KlarMoneyPipe,
    KlarNotificationBellComponent,
  ],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.css',
})
export class TopBarComponent {
  title         = input('');
  subtitle      = input<string>();
  monthChip     = input('April 2026');
  showPlanspiel = input(false);
  showAdd       = input(false);
  showExport     = input(false);
  addLabel      = input('Buchung');
  stats         = input<PageStat[]>([]);

  addClick       = output<void>();
  planspielClick = output<void>();
  exportClick    = output<void>();

  statColor(tone: PageStat['tone']): string {
    switch (tone) {
      case 'income':  return 'text-(--color-income)';
      case 'expense': return 'text-(--color-expense)';
      case 'surplus': return 'text-(--color-surplus)';
      case 'neutral': return 'text-(--text-muted)';
    }
  }
}
