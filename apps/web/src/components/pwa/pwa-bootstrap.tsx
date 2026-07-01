'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { registerServiceWorker } from '@/lib/pwa/register-sw'
import { resumeBrowserMobileTelemetry } from '@/lib/mobile/browser-activation'

export function PwaBootstrap() {
  const router = useRouter()

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    let removeControllerChange: (() => void) | undefined

    resumeBrowserMobileTelemetry()

    registerServiceWorker()
      .then(async (reg) => {
        if (!reg) return

        // Limpiar cachés de service workers anteriores que rompían la carga
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.filter(k => k.startsWith('trackpro-pwa-')).map(k => caches.delete(k)))
        }

        await reg.update().catch(() => {})

        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        const onControllerChange = () => {
          if (sessionStorage.getItem('trackpro-sw-reloaded') === '1') return
          sessionStorage.setItem('trackpro-sw-reloaded', '1')
          router.refresh()
        }
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
        removeControllerChange = () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)

        interval = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {})

    return () => {
      if (interval) clearInterval(interval)
      removeControllerChange?.()
    }
  }, [router])
  return null
}
