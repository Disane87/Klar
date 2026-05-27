import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';

export interface PushSubscriptionDto {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-vapid' | 'ios-needs-pwa' | 'error'; message?: string };

/**
 * Web Push lifecycle on the frontend. Registers the service worker,
 * subscribes via PushManager, posts the subscription to the backend,
 * and exposes idempotent enable/disable for the settings toggle.
 *
 * iOS gating: web push works on iOS ≥ 16.4 only when the site is
 * installed as a PWA (display-mode standalone). The settings UI uses
 * the iosBlocked() signal to render an "Add to Home Screen first" hint
 * instead of a broken toggle.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly http = inject(HttpClient);
  private readonly householdStore = inject(HouseholdStore);

  readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  readonly subscribed = signal(false);
  readonly subscriptions = signal<PushSubscriptionDto[]>([]);

  readonly supported = signal<boolean>(
    typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window,
  );

  readonly iosBlocked = signal<boolean>(this.detectIosBlocked());

  async enable(): Promise<EnableResult> {
    if (!this.supported()) return { ok: false, reason: 'unsupported' };
    if (this.iosBlocked()) return { ok: false, reason: 'ios-needs-pwa' };

    const householdId = this.householdStore.activeId();
    if (!householdId) return { ok: false, reason: 'error', message: 'Kein aktiver Haushalt' };

    const permission = await Notification.requestPermission();
    this.permission.set(permission);
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    try {
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>(
          `/api/v1/households/${householdId}/push-subscriptions/vapid-public-key`,
        ),
      );
      if (!publicKey) return { ok: false, reason: 'no-vapid' };

      const keyBytes = this.urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Browser expects ArrayBuffer-backed view; copy into a fresh ArrayBuffer
        // so TS doesn't complain about ArrayBufferLike unions.
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });
      const json = sub.toJSON();
      const keys = (json.keys as { p256dh?: string; auth?: string } | undefined) ?? {};
      if (!keys.p256dh || !keys.auth) {
        return { ok: false, reason: 'error', message: 'Push-Keys fehlen' };
      }

      await firstValueFrom(
        this.http.post(
          `/api/v1/households/${householdId}/push-subscriptions`,
          {
            endpoint: sub.endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth },
            userAgent: navigator.userAgent,
          },
        ),
      );
      this.subscribed.set(true);
      await this.refreshSubscriptions();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'error', message: (err as Error).message };
    }
  }

  /**
   * Unsubscribes the current browser endpoint AND deletes its server-side
   * row. Other devices remain active.
   */
  async disable(): Promise<void> {
    if (!this.supported()) return;
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const local = this.subscriptions().find(s => s.endpoint === sub.endpoint);
        await sub.unsubscribe();
        if (local) {
          await firstValueFrom(
            this.http.delete(
              `/api/v1/households/${householdId}/push-subscriptions/${local.id}`,
            ),
          );
        }
      }
    } finally {
      this.subscribed.set(false);
      await this.refreshSubscriptions();
    }
  }

  async refreshSubscriptions(): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    try {
      const list = await firstValueFrom(
        this.http.get<PushSubscriptionDto[]>(
          `/api/v1/households/${householdId}/push-subscriptions`,
        ),
      );
      this.subscriptions.set(list);
      this.subscribed.set(list.length > 0);
    } catch {
      // best-effort UI signal
    }
  }

  private detectIosBlocked(): boolean {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOS) return false;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    return !standalone;
  }

  private urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const padded = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }
}
