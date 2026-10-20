// MONSPORT service worker (brief F-014). It shows Web Push notifications and nothing else:
// no cache and no fetch handler, so an old copy never serves old files.

const FALLBACK_TITLE = 'MONSPORT: Bạn có thông báo mới';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Safari revokes a subscription when a push shows nothing, so every push calls showNotification.
self.addEventListener('push', (event) => {
  let title = FALLBACK_TITLE;
  let body = '';
  let notificationId;
  try {
    const payload = event.data.json();
    if (typeof payload.title === 'string' && payload.title !== '') title = payload.title;
    if (typeof payload.body === 'string') body = payload.body;
    if (typeof payload.notificationId === 'string') notificationId = payload.notificationId;
  } catch {
    // No data, or data that is not JSON: the fallback title shows.
  }
  event.waitUntil(
    self.registration.showNotification(title, { body, data: { notificationId }, icon: '/icon-192.png' }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      if (windows.length > 0) return windows[0].focus();
      return self.clients.openWindow('/');
    }),
  );
});
