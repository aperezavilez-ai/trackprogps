// Solo notificaciones push — sin interceptar navegación (evita ERR_FAILED por caché rota)
const CACHE_VERSION = 'trackpro-pwa-v3'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(Promise.resolve())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('push', (event) => {
  let payload = { title: 'TrackPro GPS', body: 'Nueva alerta', url: '/alerts' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch { /* default */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url ?? '/alerts' },
      tag: 'trackpro-alert',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/alerts'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
