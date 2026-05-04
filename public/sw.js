// Splash Service Worker — handles push notifications and PWA caching

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ── Push notification handler ────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()
  const { title, body, url = '/', icon = '/icons/icon-192.png' } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-192.png',
      data:  { url },
      vibrate: [200, 100, 200],
    })
  )
})

// ── Notification click — open the app at the relevant URL ───────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
