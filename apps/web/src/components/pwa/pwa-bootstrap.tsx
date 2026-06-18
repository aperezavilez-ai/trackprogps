'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa/register-sw'

export function PwaBootstrap() {
  useEffect(() => {
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
          window.location.reload()
        }
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

        const interval = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
        return () => {
          clearInterval(interval)
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        }
      })
      .catch(() => {})
  }, [])
  return null
}
