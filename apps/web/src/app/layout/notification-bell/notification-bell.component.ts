import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  HostListener,
  ElementRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { NotificationStore } from '../../core/notifications/notifications.store';
import type { NotificationDto } from '../../core/notifications/notifications.service';

/**
 * Notification bell + slide-down popover (Klar Design Pearl).
 * Lives inside the page-header. Renders an unread-count dot tinted in
 * --accent and opens a centered popover with the user's recent
 * notifications. Click outside or Escape to close.
 */
@Component({
  selector: 'klar-notification-bell',
  standalone: true,
  imports: [KlarIconComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-flex' },
  template: `
    <button
      type="button"
      class="btn ghost icon-only relative"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <klar-icon name="bell" [size]="14" />
      @if (store.hasUnread()) {
        <span
          class="absolute top-1 right-1 size-1.5 rounded-full"
          style="background: var(--accent); box-shadow: 0 0 6px var(--accent);"
          aria-hidden="true"
        ></span>
      }
    </button>

    @if (open()) {
      <div
        class="klar-pop fixed w-[360px] max-w-[92vw] z-50 rounded-lg border border-(--line) overflow-hidden"
        [style.top.px]="popoverTop()"
        [style.right.px]="popoverRight()"
        style="background: var(--bg-1); box-shadow: var(--shadow-modal);"
        role="dialog"
        aria-label="Benachrichtigungen"
      >
        <header class="flex items-center justify-between px-4 py-3 border-b border-(--line-soft)">
          <span class="text-[13px] font-medium" style="font-family: var(--font-display); letter-spacing: -0.01em;">
            Benachrichtigungen
          </span>
          @if (store.hasUnread()) {
            <button type="button" class="text-[11px] text-(--accent) hover:opacity-80" (click)="markAllRead()">
              Alle gelesen
            </button>
          }
        </header>

        @if (store.loading() && store.items().length === 0) {
          <div class="px-4 py-6 text-center text-[12px] text-(--fg-2)">Lädt …</div>
        } @else if (store.items().length === 0) {
          <div class="px-4 py-8 text-center">
            <div class="text-[12px] text-(--fg-2)">Keine Benachrichtigungen.</div>
          </div>
        } @else {
          <ul class="max-h-[55vh] overflow-y-auto">
            @for (n of store.items(); track n.id) {
              <li
                class="px-4 py-3 border-b border-(--line-soft) last:border-b-0 cursor-pointer hover:bg-(--bg-2) transition-colors"
                [class.bg-(--accent-soft)]="!n.readAt"
                (click)="handleClick(n)"
              >
                <div class="flex items-start gap-2">
                  @if (!n.readAt) {
                    <span
                      class="mt-1.5 size-1.5 rounded-full shrink-0"
                      style="background: var(--accent);"
                      aria-hidden="true"
                    ></span>
                  } @else {
                    <span class="mt-1.5 size-1.5 shrink-0" aria-hidden="true"></span>
                  }
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-medium text-(--fg) truncate">{{ n.title }}</div>
                    @if (n.body) {
                      <div class="text-[12px] text-(--fg-2) mt-0.5 line-clamp-2">{{ n.body }}</div>
                    }
                    <div class="text-[10px] text-(--fg-3) mt-1.5 mono uppercase tracking-[0.04em]">
                      {{ n.createdAt | date:'dd.MM.yyyy HH:mm' }}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="text-(--fg-3) hover:text-(--danger) shrink-0"
                    [attr.aria-label]="'Löschen: ' + n.title"
                    (click)="$event.stopPropagation(); remove(n.id)"
                  >
                    <klar-icon name="x" [size]="12" />
                  </button>
                </div>
              </li>
            }
          </ul>
        }

        <footer class="px-4 py-2.5 border-t border-(--line-soft) flex items-center justify-between text-[11px]">
          <span class="text-(--fg-3)">
            Benachrichtigungen folgen deinen Regeln.
          </span>
          <button
            type="button"
            class="text-(--accent) hover:opacity-80"
            (click)="openRules()"
          >
            Regeln verwalten →
          </button>
        </footer>
      </div>
    }
  `,
})
export class KlarNotificationBellComponent {
  protected readonly store = inject(NotificationStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  // Popover uses position: fixed (escapes the top-bar's overflow-x-auto
  // clip) — coordinates are computed from the bell's bounding rect on
  // every toggle and on viewport resize while open.
  protected readonly popoverTop = signal(56);
  protected readonly popoverRight = signal(16);

  protected readonly ariaLabel = computed(() => {
    const n = this.store.unreadCount();
    return n > 0
      ? `Benachrichtigungen, ${n} ungelesen`
      : 'Benachrichtigungen';
  });

  toggle(): void {
    const next = !this.open();
    if (next) this.recomputePopoverPosition();
    this.open.set(next);
  }

  private recomputePopoverPosition(): void {
    const button = this.host.nativeElement.querySelector('button');
    if (!button) return;
    const rect = button.getBoundingClientRect();
    // 8px gap below the button (mirrors the old mt-2). Right edge of the
    // popover aligns with the right edge of the button.
    this.popoverTop.set(Math.round(rect.bottom + 8));
    this.popoverRight.set(
      Math.max(8, Math.round(window.innerWidth - rect.right)),
    );
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) this.recomputePopoverPosition();
  }

  close(): void {
    this.open.set(false);
  }

  protected openRules(): void {
    this.close();
    void this.router.navigate(['/app/settings/notifications']);
  }

  protected async handleClick(n: NotificationDto): Promise<void> {
    if (!n.readAt) await this.store.markRead(n.id);
  }

  protected async markAllRead(): Promise<void> {
    await this.store.markAllRead();
  }

  protected async remove(id: string): Promise<void> {
    await this.store.remove(id);
  }

  /** Close on Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  /** Close on outside click. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
