'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, MapPin, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type PanicStatus = 'idle' | 'confirm' | 'sending' | 'sent' | 'error' | 'no-device'

type StoredMobileTracking = {
  deviceId?: string
  device_id?: string
  deviceUid?: string
  device_uid?: string
}

const ACTIVE_TRACKING_KEY = 'trackpro_mobile_tracking_active'
const DEVICE_UID_KEY = 'trackpro_mobile_device_uid'

export function PanicButton({
  className,
  deviceId,
  deviceUid,
  lat,
  lng,
  deviceName,
  contactSummary,
}: {
  className?: string
  deviceId?: string
  deviceUid?: string
  lat?: number | null
  lng?: number | null
  deviceName?: string
  contactSummary?: string
}) {
  const [status, setStatus] = useState<PanicStatus>('idle')
  const [message, setMessage] = useState('')

  const dialogTitle = useMemo(() => {
    if (status === 'sent') return 'SOS enviado'
    if (status === 'no-device') return 'Activa este telefono'
    if (status === 'error') return 'No se pudo enviar'
    if (status === 'sending') return 'Enviando SOS'
    return 'Boton de panico'
  }, [status])

  const close = () => {
    if (status === 'sending') return
    setStatus('idle')
    setMessage('')
  }

  async function sendPanic() {
    const ids = deviceId || deviceUid ? { deviceId, deviceUid } : getMobileDeviceIdentity()
    if (!ids.deviceId && !ids.deviceUid) {
      setStatus('no-device')
      setMessage('Para enviar una alerta con ubicacion real, primero activa este telefono como movil TrackProGPS.')
      return
    }

    setStatus('sending')
    setMessage('Solicitando ubicacion del telefono...')

    try {
      const position = lat != null && lng != null
        ? null
        : await getCurrentPosition()
      setMessage('Registrando alerta critica...')

      const response = await fetch('/api/mobile/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(ids.deviceId ? { device_id: ids.deviceId } : { device_uid: ids.deviceUid }),
          lat: lat ?? position!.coords.latitude,
          lng: lng ?? position!.coords.longitude,
          battery_pct: null,
          payload: {
            source: 'web_panic_button',
            trigger: 'panic_button',
            triggered_from: window.location.pathname,
            user_agent: navigator.userAgent,
            accuracy_m: position?.coords.accuracy ?? null,
            recorded_at: new Date(position?.timestamp ?? Date.now()).toISOString(),
            device_name: deviceName ?? null,
          },
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'La plataforma rechazo el SOS.')
      }

      setStatus('sent')
      setMessage('La alerta critica quedo registrada con la ubicacion actual.')
    } catch (error) {
      setStatus('error')
      setMessage(getPanicErrorMessage(error))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStatus('confirm')}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:px-3 sm:text-sm',
          className,
        )}
        title="Boton de panico"
        aria-label="Abrir boton de panico"
      >
        <ShieldAlert className="h-4 w-4" />
        <span className="hidden sm:inline">Panico</span>
        <span className="sm:hidden">SOS</span>
      </button>

      {status !== 'idle' && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 px-4 py-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="panic-dialog-title">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                )}>
                  {status === 'sent' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <h2 id="panic-dialog-title" className="text-sm font-semibold text-gray-900">{dialogTitle}</h2>
                  <p className="mt-0.5 text-xs text-gray-500">TrackProGPS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={status === 'sending'}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              {status === 'confirm' && (
                <>
                  <p className="text-sm text-gray-700">
                    Se enviara una alerta critica con la ubicacion {lat != null && lng != null ? 'actual registrada de este dispositivo' : 'actual de este telefono'}.
                  </p>
                  {deviceName && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                      Dispositivo: <span className="font-semibold">{deviceName}</span>
                    </div>
                  )}
                  {contactSummary && (
                    <div className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs text-red-700">
                      Aviso registrado para: {contactSummary}
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    El navegador puede pedir autorizacion de ubicacion solo al enviar.
                  </div>
                </>
              )}

              {status !== 'confirm' && (
                <p className="text-sm text-gray-700">{message}</p>
              )}

              {status === 'sending' && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  No cierres esta ventana.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-4 sm:flex-row-reverse">
              {status === 'confirm' && (
                <>
                  <button
                    type="button"
                    onClick={() => void sendPanic()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Enviar SOS
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </>
              )}

              {status === 'no-device' && (
                <>
                  <Link
                    href="/descargar"
                    onClick={close}
                    className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Activar telefono
                  </Link>
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </>
              )}

              {(status === 'sent' || status === 'error') && (
                <>
                  {status === 'sent' && (
                    <Link
                      href="/alerts"
                      onClick={close}
                      className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                      Ver alertas
                    </Link>
                  )}
                  {status === 'error' && (
                    <button
                      type="button"
                      onClick={() => setStatus('confirm')}
                      className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Reintentar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getMobileDeviceIdentity(): { deviceId?: string; deviceUid?: string } {
  const active = readStoredTracking()
  const deviceId = active?.deviceId ?? active?.device_id
  const deviceUid = active?.deviceUid ?? active?.device_uid ?? localStorage.getItem(DEVICE_UID_KEY) ?? undefined
  return { deviceId, deviceUid }
}

function readStoredTracking(): StoredMobileTracking | null {
  const raw = localStorage.getItem(ACTIVE_TRACKING_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredMobileTracking
  } catch {
    return null
  }
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no soporta ubicacion.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    })
  })
}

function getPanicErrorMessage(error: unknown) {
  const geoError = typeof error === 'object' && error !== null && 'code' in error
    ? error as { code?: number }
    : null
  if (geoError?.code != null) {
    if (geoError.code === 1) return 'El telefono nego el permiso de ubicacion. Activalo para TrackProGPS y vuelve a intentar.'
    if (geoError.code === 2) return 'No se pudo obtener ubicacion GPS en este momento.'
    if (geoError.code === 3) return 'El telefono tardo demasiado en entregar ubicacion. Intenta de nuevo al aire libre o con mejor senal.'
  }
  if (error instanceof Error) return error.message
  return 'Ocurrio un error inesperado.'
}
