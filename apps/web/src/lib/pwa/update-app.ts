export async function forcePwaUpdate() {
  if (typeof window === 'undefined') return

  if ('serviceWorker' in navigator) {
    const settleWithin = async <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
      let timer: number | undefined
      try {
        return await Promise.race([
          promise,
          new Promise<null>((resolve) => {
            timer = window.setTimeout(() => resolve(null), ms)
          }),
        ])
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const registrations = typeof navigator.serviceWorker.getRegistrations === 'function'
      ? await settleWithin(navigator.serviceWorker.getRegistrations().catch(() => []), 2500) ?? []
      : []
    const scopedRegistration = await settleWithin(navigator.serviceWorker.getRegistration('/').catch(() => undefined), 1500)
    const readyRegistration = await settleWithin(navigator.serviceWorker.ready.catch(() => null), 2500)
    const uniqueRegistrations = Array.from(new Set([
      ...registrations,
      scopedRegistration,
      readyRegistration,
    ].filter((registration): registration is ServiceWorkerRegistration => Boolean(registration))))

    await Promise.all(uniqueRegistrations.map(async (registration) => {
      await settleWithin(registration.update().catch(() => undefined), 2500)

      if (registration.waiting) {
        await new Promise<void>((resolve) => {
          let resolved = false
          const done = () => {
            if (resolved) return
            resolved = true
            resolve()
          }
          const timer = window.setTimeout(done, 1500)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.clearTimeout(timer)
            done()
          }, { once: true })
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        })
      }
    }))
  }

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }

  const stamp = String(Date.now())
  const currentUrl = new URL(window.location.href)
  currentUrl.searchParams.set('app_update_probe', stamp)

  await Promise.allSettled([
    fetchWithTimeout(`/sw.js?app_update=${stamp}`),
    fetchWithTimeout(`/manifest.webmanifest?app_update=${stamp}`),
    fetchWithTimeout(currentUrl.toString(), { credentials: 'same-origin' }),
  ])

  const url = new URL(window.location.href)
  url.searchParams.set('app_update', stamp)
  url.searchParams.delete('app_update_probe')
  window.location.replace(url.toString())
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 3500)
  try {
    return await fetch(input, {
      ...init,
      cache: 'reload',
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}
