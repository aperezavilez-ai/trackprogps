'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Smartphone, Battery, Wifi, WifiOff, MapPin, User, RefreshCw, Loader2, Power,
} from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import { MobilePermissionSetup } from './mobile-permission-setup'

interface MobileDevice {
  id: string
  imei: string
  model: string
  status: string
  last_seen: string | null
  mobile_platform: 'android' | 'ios' | null
  tracking_enabled: boolean
  tracking_interval_sec: number
  mobile_metadata: Record<string, unknown>
  assigned_user_id: string | null
  vehicle: { economic_num: string; plates: string; id: string } | null
}

interface Stats {
  total: number
  online: number
  offline: number
  tracking_enabled: number
}

const PLATFORM_LABEL: Record<string, string> = {
  android: 'Android',
  ios: 'iPhone',
}

export function MobileDashboardClient() {
  const { canWriteFleet } = usePermissions()
  const [devices, setDevices] = useState<MobileDevice[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/mobile/dashboard')
      const json = await res.json()
      setDevices(json.data?.devices ?? [])
      setStats(json.data?.stats ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function revokeSession(deviceId: string) {
    if (!confirm('¿Cerrar sesión remota y pausar rastreo en este teléfono?')) return
    setRevoking(deviceId)
    try {
      await fetch('/api/mobile/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      })
      await load()
    } finally {
      setRevoking(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando móviles…
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rastreo móvil</h1>
          <p className="text-sm text-gray-500 mt-1">
            Teléfonos Android e iPhone como unidades GPS integradas
          </p>
          {stats && (
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <span>{stats.total} dispositivos</span>
              <span className="text-green-600 font-medium">● {stats.online} en línea</span>
              <span className="text-gray-400">○ {stats.offline} desconectados</span>
              <span>{stats.tracking_enabled} rastreando</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="p-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <MobilePermissionSetup onActivated={() => void load()} />

      {devices.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Sin teléfonos registrados</p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            Los usuarios pueden registrar su teléfono desde la app TrackProGPS Mobile al iniciar sesión,
            o puedes pre-registrar desde Dispositivos → Registrar móvil.
          </p>
          <Link href="/devices" className="inline-block mt-4 text-orange-600 text-sm font-medium hover:underline">
            Ir a dispositivos →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map(d => {
            const meta = d.mobile_metadata ?? {}
            const battery = meta.battery_pct as number | undefined
            const isOnline = d.status === 'online'
            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${d.mobile_platform === 'ios' ? 'bg-gray-100' : 'bg-green-50'}`}>
                      <Smartphone className={`w-5 h-5 ${d.mobile_platform === 'ios' ? 'text-gray-700' : 'text-green-600'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{d.model}</div>
                      <div className="text-xs text-gray-500">
                        {PLATFORM_LABEL[d.mobile_platform ?? ''] ?? 'Móvil'}
                        {meta.app_version ? ` · v${meta.app_version}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isOnline ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isOnline ? 'En línea' : 'Desconectado'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {d.vehicle && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {d.vehicle.economic_num} — {d.vehicle.plates}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    Usuario asignado · {d.assigned_user_id?.slice(0, 8) ?? '—'}…
                  </div>
                  <div className="flex items-center gap-2">
                    {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-gray-400" />}
                    Última conexión: {d.last_seen
                      ? new Date(d.last_seen).toLocaleString('es-MX')
                      : 'Nunca'}
                  </div>
                  {battery != null && (
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-gray-400" />
                      Batería: {battery}%
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    Intervalo: {d.tracking_interval_sec}s ·
                    {d.tracking_enabled ? ' Rastreo activo' : ' Rastreo pausado'}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                  {d.vehicle && (
                    <Link
                      href={`/history?vehicle_id=${d.vehicle.id}`}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700"
                    >
                      Historial →
                    </Link>
                  )}
                  <Link href={`/map`} className="text-xs font-medium text-orange-600 hover:text-orange-700">
                    Ver en mapa →
                  </Link>
                  {canWriteFleet && (
                    <button
                      type="button"
                      disabled={revoking === d.id}
                      onClick={() => void revokeSession(d.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      <Power className="w-3 h-3" />
                      {revoking === d.id ? 'Cerrando…' : 'Cerrar sesión'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
