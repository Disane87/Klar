import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { humanizePredicate, type Predicate } from '@klar/shared';
import { KlarHeroComponent } from '../../../shared/ui/klar-hero.component';
import { KlarButtonComponent } from '../../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
import { KlarBadgeComponent } from '../../../shared/ui/klar-badge.component';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { KlarConfirmService } from '../../../shared/ui/klar-confirm.service';
import { NotificationRulesStore } from '../../../core/notification-rules/notification-rules.store';
import type { NotificationRuleDto } from '../../../core/notification-rules/notification-rules.service';
import { NotificationRuleDialogComponent } from './notification-rule-dialog.component';

@Component({
  selector: 'klar-notification-rules-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    KlarHeroComponent,
    KlarButtonComponent,
    KlarIconComponent,
    KlarBadgeComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      <klar-hero
        eyebrow="Benachrichtigungen"
        title="Regeln für Hinweise"
        sub="Lege selbst fest, wann Klar dir Bescheid gibt — z. B. bei Gehaltseingang, großen Ausgaben oder verdächtigen Buchungen. Regeln werden idempotent ausgewertet: jede Buchung löst eine Regel höchstens einmal aus."
      >
        <klar-icon heroEyebrowIcon name="bell" [size]="11" />
        <div heroActions>
          <klar-button tone="primary" size="sm" icon="plus" (click)="openCreate()">
            Neue Regel
          </klar-button>
        </div>
      </klar-hero>

      @if (store.loading() && rules().length === 0) {
        <div class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)">
          Lädt …
        </div>
      } @else if (rules().length === 0) {
        <div class="rounded-lg border border-dashed border-(--line) bg-(--bg-1) px-5 py-10 text-center">
          <div class="text-[13px] text-(--fg)">Noch keine Regeln.</div>
          <div class="text-[12px] text-(--fg-3) mt-1">
            Lege eine Regel an, um z. B. beim nächsten Gehaltseingang benachrichtigt zu werden.
          </div>
        </div>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (rule of rules(); track rule.id) {
            <li
              class="rounded-md border border-(--line-soft) bg-(--bg-1) p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[14px] font-medium text-(--fg) truncate">{{ rule.name }}</span>
                  <klar-badge [tone]="rule.enabled ? 'success' : 'neutral'">
                    {{ rule.enabled ? 'aktiv' : 'aus' }}
                  </klar-badge>
                  <klar-badge tone="info">{{ triggerLabel(rule.trigger) }}</klar-badge>
                  @for (ch of rule.channels; track ch) {
                    <klar-badge tone="accent">{{ channelLabel(ch) }}</klar-badge>
                  }
                </div>
                <div class="text-[12px] text-(--fg-2) mt-1 line-clamp-2">
                  {{ describe(rule) }}
                </div>
                @if (rule.lastFiredAt) {
                  <div class="text-[11px] text-(--fg-3) mt-1 mono">
                    Zuletzt: {{ rule.lastFiredAt | date: 'dd.MM.yyyy HH:mm' }}
                  </div>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <klar-button
                  tone="ghost"
                  size="sm"
                  icon="zap"
                  (click)="onTest(rule)"
                  [disabled]="testing() === rule.id"
                >
                  Test
                </klar-button>
                <klar-button tone="ghost" size="sm" icon="edit" (click)="openEdit(rule)">
                  Bearbeiten
                </klar-button>
                <klar-button tone="ghost" size="sm" icon="trash" (click)="onDelete(rule)" />
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class NotificationRulesPageComponent {
  protected readonly store = inject(NotificationRulesStore);
  private readonly dialog = inject(KlarDialogService);
  private readonly confirm = inject(KlarConfirmService);

  protected readonly rules = computed<NotificationRuleDto[]>(() => this.store.items());
  protected readonly testing = (() => {
    let value: string | null = null;
    return () => value;
  })();

  protected openCreate(): void {
    this.dialog.open({
      title: 'Neue Regel',
      component: NotificationRuleDialogComponent,
      width: 'lg',
      inputs: { existing: null },
    });
  }

  protected openEdit(rule: NotificationRuleDto): void {
    this.dialog.open({
      title: 'Regel bearbeiten',
      component: NotificationRuleDialogComponent,
      width: 'lg',
      inputs: { existing: rule },
    });
  }

  protected async onTest(rule: NotificationRuleDto): Promise<void> {
    await this.store.test(rule.id);
  }

  protected async onDelete(rule: NotificationRuleDto): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Regel löschen?',
      message: `"${rule.name}" wird unwiderruflich entfernt.`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!ok) return;
    await this.store.remove(rule.id);
  }

  protected describe(rule: NotificationRuleDto): string {
    try {
      return humanizePredicate(rule.predicate as Predicate, { trigger: rule.trigger });
    } catch {
      return '(Bedingung nicht darstellbar)';
    }
  }

  protected triggerLabel(trigger: NotificationRuleDto['trigger']): string {
    switch (trigger) {
      case 'TRANSACTION_CREATED': return 'Buchung';
      case 'STANDING_ORDER_DUE': return 'Dauerauftrag';
      case 'BUDGET_THRESHOLD': return 'Budget';
      case 'FINTS_SYNC_EVENT': return 'FinTS';
      case 'SCHEDULED': return 'Zeitplan';
    }
  }

  protected channelLabel(ch: string): string {
    switch (ch) {
      case 'IN_APP': return 'Inbox';
      case 'WEB_PUSH': return 'Push';
      case 'EMAIL': return 'Mail';
      default: return ch;
    }
  }
}
