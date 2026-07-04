'use client'

import { useEffect } from 'react'
import { markPwaDisplayMode, registerServiceWorker } from '@/lib/pwa/register-sw'
import { resumeBrowserMobileTelemetry } from '@/lib/mobile/browser-activation'

export function PwaBootstrap() {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    let removeControllerChange: (() => void) | undefined

    resumeBrowserMobileTelemetry()
    markPwaDisplayMode()

    const resumeMobile = () => {
      if (document.visibilityState === 'hidden') return
      resumeBrowserMobileTelemetry()
    }

    window.addEventListener('pageshow', resumeMobile)
    window.addEventListener('focus', resumeMobile)
    window.addEventListener('online', resumeMobile)
    document.addEventListener('visibilitychange', resumeMobile)

    registerServiceWorker()
      .then(async (reg) => {
        if (!reg) return

        const swVersion = await readServiceWorkerVersion()

        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.filter(k => k.startsWith('trackpro-pwa-')).map(k => caches.delete(k)))
        }

        const onControllerChange = () => {
          const reloadKey = `trackpro-sw-reloaded:${swVersion ?? 'unknown'}`
          if (sessionStorage.getItem(reloadKey) === '1') return
          sessionStorage.setItem(reloadKey, '1')
          resumeMobile()
          window.location.reload()
        }
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
        removeControllerChange = () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)

        await reg.update().catch(() => {})

        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        interval = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {})

    return () => {
      if (interval) clearInterval(interval)
      removeControllerChange?.()
      window.removeEventListener('pageshow', resumeMobile)
      window.removeEventListener('focus', resumeMobile)
      window.removeEventListener('online', resumeMobile)
      document.removeEventListener('visibilitychange', resumeMobile)
    }
  }, [])

  return null
}

async function readServiceWorkerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/sw.js?version=${Date.now()}`, { cache: 'no-store' })
    const text = await res.text()
    return text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null
  } catch {
    return null
  }
}
