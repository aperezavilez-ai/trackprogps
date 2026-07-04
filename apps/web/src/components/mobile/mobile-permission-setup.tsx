'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react'
import {
  activateBrowserMobileTracking,
  isMobileBrowserPlatform,
  type BrowserPermissionMap,
} from '@/lib/mobile/browser-activation'

type ActivationState = 'idle' | 'running' | 'ready' | 'partial' | 'login' | 'error'

type Props = {
  compact?: boolean
  deviceId?: string
  deviceUid?: string
  title?: string
  description?: string
  activationHref?: string
  continueOnRegistered?: boolean
  onActivated?: () => void
  onSkip?: () => void
}

const ACTIVATION_STORAGE_KEY = 'trackpro_mobile_activation'

type StoredActivation = {
  permissions?: BrowserPermissionMap
  registered?: boolean
  telemetrySent?: boolean
  updated_at?: string
}

function getActivationStorageKey(deviceId?: string, deviceUid?: string) {
  if (deviceId) return `${ACTIVATION_STORAGE_KEY}:device:${deviceId}`
  if (deviceUid) return `${ACTIVATION_STORAGE_KEY}:uid:${deviceUid}`
  return ACTIVATION_STORAGE_KEY
}

export function MobilePermissionSetup({
  compact = false,
  deviceId,
  deviceUid,
  title = 'Autorizar TrackPro',
  description = 'Toca una vez y acepta los avisos del telefono.',
  activationHref,
  continueOnRegistered = false,
  onActivated,
  onSkip,
}: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [state, setState] = useState<ActivationState>('idle')
  const [message, setMessage] = useState('')
  const activationKey = getActivationStorageKey(deviceId, deviceUid)

  useEffect(() => {
    setIsMobile(isMobileBrowserPlatform())
    try {
      const stored = localStorage.getItem(activationKey)
      const fallback = localStorage.getItem('trackpro_mobile_permissions')
      const parsed = JSON.parse(stored ?? fallback ?? 'null') as StoredActivation | null

      if (parsed?.registered && parsed?.telemetrySent) {
        setMessage('Autorizacion previa detectada. Toca Autorizar app para reactivar el rastreo.')
      }
    } catch {
      // Ignore stale local activation data.
    }
  }, [activationKey])

  function persistActivation(result: { permissions: BrowserPermissionMap; registered: boolean; telemetrySent: boolean }) {
    localStorage.setItem(activationKey, JSON.stringify({
      ...result,
      updated_at: new Date().toISOString(),
    }))
  }

  async function activate() {
    setState('running')
    setMessage('Abriendo autorizacion...')

    try {
      const result = await activateBrowserMobileTracking({ deviceId, deviceUid })
      if (result.needsLogin) {
        setState('login')
        setMessage('Inicia sesion en este telefono y vuelve a autorizar.')
        return
      }

      if (result.registered && (result.telemetrySent || result.permissions.location || continueOnRegistered)) {
        persistActivation({
          permissions: result.permissions,
          registered: result.registered,
          telemetrySent: result.telemetrySent,
        })
        setState('ready')
        setMessage(result.telemetrySent
          ? 'Autorizacion lista.'
          : 'Autorizacion guardada. Abriendo app...')
        onActivated?.()
        return
      }

      if (result.registered) {
        persistActivation({
          permissions: result.permissions,
          registered: true,
          telemetrySent: result.telemetrySent,
        })
        setState('partial')
        setMessage('App autorizada. Falta permiso de ubicacion para mostrar el movil en vivo.')
        onActivated?.()
        return
      }

      setState('error')
      setMessage('No se pudo completar la autorizacion. Puedes entrar y reintentar el rastreo despues.')
    } catch {
      setState('error')
      setMessage('No se pudo abrir la autorizacion. Revisa los ajustes del navegador.')
    }
  }

  return (
    <div className={compact
      ? 'rounded-xl border border-white/10 bg-white/[0.04] p-4'
      : 'rounded-2xl border border-teal-100 bg-teal-50 p-4 mb-5'}>
      <div className="flex items-start gap-3">
        <div className={compact ? 'p-2 rounded-xl bg-white/10 text-teal-200' : 'p-2 rounded-xl bg-white text-teal-600'}>
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={compact ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-gray-900'}>
            {title}
          </div>
          <p className={compact ? 'text-xs text-white/60 mt-1' : 'text-xs text-gray-500 mt-1'}>
            {description}
          </p>

          {message && (
            <div className={compact ? 'mt-3 text-xs text-white/70' : 'mt-3 text-xs text-gray-600'}>
              {state === 'error' && <WifiOff className="inline w-3 h-3 mr-1 text-red-500" />}
              {message}
            </div>
          )}

          {state === 'ready' ? (
            <button
              type="button"
              onClick={() => void activate()}
              className={compact
                ? 'mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5'
                : 'mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50'}
            >
              <RefreshCw className="w-4 h-4" />
              Reactivar rastreo
            </button>
          ) : isMobile ? (
            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={state === 'running'}
                onClick={() => void activate()}
                className={compact
                  ? 'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-60'
                  : 'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60'}
              >
                {state === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {state === 'running' ? 'Autorizando...' : state === 'error' ? 'Reintentar autorizacion' : 'Autorizar app'}
              </button>
              {onSkip && state !== 'running' && (
                <button
                  type="button"
                  onClick={onSkip}
                  className={compact
                    ? 'w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5'
                    : 'rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50'}
                >
                  Entrar sin activar rastreo
                </button>
              )}
            </div>
          ) : (
            <div className={compact
              ? 'mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60'
              : 'mt-4 rounded-xl border border-teal-100 bg-white px-3 py-2 text-xs text-gray-600'}>
              <ExternalLink className="inline w-3.5 h-3.5 mr-1.5" />
              Abre esta pantalla desde el telefono para autorizar la app.
              {activationHref && (
                <a
                  href={activationHref}
                  className={compact ? 'ml-1 font-medium text-white hover:underline' : 'ml-1 font-medium text-teal-700 hover:underline'}
                >
                  Enlace de activacion
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
