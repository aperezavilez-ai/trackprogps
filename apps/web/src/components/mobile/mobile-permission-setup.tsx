'use client'

import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, ExternalLink, Loader2, MapPin, Mic, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react'
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
  onActivated?: () => void
}

const PERMISSION_ITEMS: Array<{ key: keyof BrowserPermissionMap; label: string; icon: typeof MapPin }> = [
  { key: 'location', label: 'Ubicación', icon: MapPin },
  { key: 'camera', label: 'Cámara', icon: Camera },
  { key: 'microphone', label: 'Micrófono', icon: Mic },
]

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
  title = 'Activar este teléfono',
  description = 'Autoriza permisos y envia una primera posición para enlazar el móvil.',
  onActivated,
}: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [state, setState] = useState<ActivationState>('idle')
  const [message, setMessage] = useState('')
  const [permissions, setPermissions] = useState<BrowserPermissionMap | null>(null)
  const activationKey = getActivationStorageKey(deviceId, deviceUid)

  useEffect(() => {
    setIsMobile(isMobileBrowserPlatform())
    try {
      const stored = localStorage.getItem(activationKey)
      const fallback = localStorage.getItem('trackpro_mobile_permissions')
      const parsed = JSON.parse(stored ?? fallback ?? 'null') as StoredActivation | null

      if (parsed?.permissions) {
        setPermissions(parsed.permissions)
      }

      if (parsed?.registered && parsed?.telemetrySent) {
        setState('ready')
        setMessage('Movil activado. Permisos guardados y primera ubicacion enviada.')
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

  function refreshStatus() {
    setMessage('Estado actualizado. Si el servidor ya recibio ubicacion, el movil aparecera en linea.')
    onActivated?.()
  }

  async function activate() {
    setState('running')
    setMessage('Solicitando permisos del teléfono...')

    try {
      const result = await activateBrowserMobileTracking({ deviceId, deviceUid })
      setPermissions(result.permissions)

      const grantedCore = result.permissions.location && result.permissions.camera && result.permissions.microphone
      if (result.needsLogin) {
        setState('login')
        setMessage('Permisos guardados en este navegador. Inicia sesión para enlazar el móvil.')
        return
      }

      if (result.registered && result.telemetrySent) {
        persistActivation({
          permissions: result.permissions,
          registered: result.registered,
          telemetrySent: result.telemetrySent,
        })
        setState('ready')
        setMessage('Móvil activado y primera ubicación enviada.')
        onActivated?.()
        return
      }

      setState(grantedCore ? 'partial' : 'error')
      setMessage(result.registered
        ? 'Móvil registrado, pero falta ubicación válida para ponerlo en línea.'
        : 'No se pudo enlazar el móvil con tu cuenta.')
      onActivated?.()
    } catch {
      setState('error')
      setMessage('No se pudieron solicitar los permisos. Revisa los ajustes del navegador.')
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

          <div className="flex flex-wrap gap-2 mt-3">
            {PERMISSION_ITEMS.map(item => {
              const Icon = item.icon
              const granted = permissions?.[item.key]
              return (
                <span
                  key={item.key}
                  className={compact
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[11px] text-gray-600'}
                >
                  {granted ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Icon className="w-3 h-3" />}
                  {item.label}
                </span>
              )
            })}
          </div>

          {message && (
            <div className={compact ? 'mt-3 text-xs text-white/70' : 'mt-3 text-xs text-gray-600'}>
              {state === 'error' && <WifiOff className="inline w-3 h-3 mr-1 text-red-500" />}
              {message}
            </div>
          )}

          {state === 'ready' ? (
            <button
              type="button"
              onClick={refreshStatus}
              className={compact
                ? 'mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5'
                : 'mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50'}
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar estado
            </button>
          ) : isMobile ? (
            <button
              type="button"
              disabled={state === 'running'}
              onClick={() => void activate()}
              className={compact
                ? 'mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-60'
                : 'mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60'}
            >
              {state === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {state === 'running' ? 'Activando...' : 'Pedir permisos ahora'}
            </button>
          ) : (
            <div className={compact
              ? 'mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60'
              : 'mt-4 rounded-xl border border-teal-100 bg-white px-3 py-2 text-xs text-gray-600'}>
              <ExternalLink className="inline w-3.5 h-3.5 mr-1.5" />
              Los permisos deben aceptarse desde el iPhone. Abre <span className="font-medium">trackprogps.mx/devices</span> en ese móvil.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
