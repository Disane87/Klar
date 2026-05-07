import { Component, computed, effect, inject, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarNotificationBellComponent } from '../notification-bell/notification-bell.component';
import { KlarUserSwitchComponent } from '../../shared/ui/klar-user-switch.component';
import { KlarScopeSegmentComponent } from '../../shared/ui/klar-scope-segment.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import type { PageStat } from '../../core/page-header/page-header.service';

@Component({
  selector: 'klar-top-bar',
  standalone: true,
  host: { class: 'block w-full' },
  imports: [
    NgClass,
    KlarButtonComponent,
    KlarMoneyPipe,
    KlarNotificationBellComponent,
    KlarUserSwitchComponent,
    KlarScopeSegmentComponent,
  ],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.css',
})
export class TopBarComponent {
  protected readonly pageHeader = inject(PageHeaderService);

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

  /** Local mirror of the service's scope value — gives us a model<> sink. */
  protected readonly scopeValue = computed(() => this.pageHeader.scopeValue());
  /** Local mirror of the service's user-switch value. */
  protected readonly userSwitchValue = computed(() => this.pageHeader.userSwitchValue());

  protected readonly showUserSwitch = computed(() => this.pageHeader.showUserSwitch());
  protected readonly scopeSegments = computed(() => this.pageHeader.scopeSegments());

  constructor() {
    // Forward changes from the user-switch / scope segment back to the
    // host page through the service's onScopeChange / onUserSwitchChange
    // hooks. Pages set those in pageHeader.set({...}) at component init.
    effect(() => {
      const id = this.pageHeader.scopeValue();
      this.pageHeader.onScopeChange()?.(id);
    });
    effect(() => {
      const id = this.pageHeader.userSwitchValue();
      this.pageHeader.onUserSwitchChange()?.(id);
    });
  }

  protected onScopeChange(id: string): void {
    this.pageHeader.scopeValue.set(id);
  }

  protected onUserSwitchChange(id: string): void {
    this.pageHeader.userSwitchValue.set(id);
  }

  statColor(tone: PageStat['tone']): string {
    switch (tone) {
      case 'income':  return 'text-(--color-income)';
      case 'expense': return 'text-(--color-expense)';
      case 'surplus': return 'text-(--color-surplus)';
      case 'neutral': return 'text-(--text-muted)';
    }
  }
}
