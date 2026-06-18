'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { isWebPushSupported, registerWebPushToken } from '@/lib/pwa/web-push'

export function PushNotificationSetup() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isWebPushSupported()) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') return
    if (sessionStorage.getItem('trackpro-push-dismissed')) return
    setVisible(true)
  }, [])

  async function enable() {
    setLoading(true)
    try {
      const ok = await registerWebPushToken()
      setDone(ok)
      if (ok) setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    sessionStorage.setItem('trackpro-push-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mx-3 mt-2 mb-0 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 shadow-sm">
      <Bell className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Activa alertas en este dispositivo</p>
        <p className="mt-0.5 text-xs text-orange-600">
          Recibe notificaciones de velocidad, geocercas y eventos críticos aunque no tengas la app abierta.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={loading || done}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? 'Activando…' : done ? 'Activado' : 'Activar alertas'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-100"
          >
            Ahora no
          </button>
        </div>
      </div>
      <button type="button" onClick={dismiss} className="text-orange-500 hover:text-orange-600" aria-label="Cerrar">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
