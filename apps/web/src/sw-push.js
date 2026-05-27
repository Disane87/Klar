// Klar custom service worker.
// Wraps Angular's ngsw-worker.js (caching/PWA) and adds Web Push
// handlers on top — ngsw doesn't expose push hooks, so we own the SW
// registration ourselves and chain ngsw via importScripts. The build
// copies ngsw-worker.js next to this file via angular.json assets.

/* eslint-disable no-restricted-globals */
/* global self, importScripts, clients */

importScripts('./ngsw-worker.js');

self.addEventListener('push', event => {
  let data = { title: 'Klar', body: '', url: '/', tag: 'klar', notificationId: null };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // Bad JSON — fall through to defaults so the notification still shows.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-72.png',
      tag: data.tag || 'klar',
      data: { url: data.url || '/', notificationId: data.notificationId || null },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = list.find(c => c.url.includes(url));
    if (existing) return existing.focus();
    return clients.openWindow(url);
  })());
});
