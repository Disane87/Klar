import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { KlarNotificationBellComponent } from './notification-bell.component';
import { NotificationStore } from '../../core/notifications/notifications.store';
import { HouseholdStore } from '../../core/household/household.store';

class StubNotificationStore {
  items = signal<Array<{ id: string; readAt: string | null }>>([]);
  unreadCount = signal(0);
  hasUnread = signal(false);
  loading = signal(false);
  error = signal(null);
  reload = vi.fn();
  markRead = vi.fn();
  markAllRead = vi.fn();
  remove = vi.fn();
}

class StubHouseholdStore {
  activeId = signal<string | null>('h1');
}

describe('KlarNotificationBellComponent', () => {
  let store: StubNotificationStore;

  beforeEach(() => {
    store = new StubNotificationStore();
    TestBed.configureTestingModule({
      imports: [KlarNotificationBellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationStore, useValue: store },
        { provide: HouseholdStore, useValue: new StubHouseholdStore() },
      ],
    });
  });

  it('toggles the popover open/closed', () => {
    const fix = TestBed.createComponent(KlarNotificationBellComponent);
    fix.detectChanges();
    const button = fix.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(fix.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
    button.click();
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    button.click();
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('shows the unread dot when hasUnread is true', () => {
    store.hasUnread.set(true);
    store.unreadCount.set(2);
    const fix = TestBed.createComponent(KlarNotificationBellComponent);
    fix.detectChanges();
    const button = fix.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toContain('2 ungelesen');
    expect(button.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
