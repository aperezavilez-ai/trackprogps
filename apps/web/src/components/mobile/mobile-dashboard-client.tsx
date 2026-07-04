'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Battery, Loader2, MapPin, Power, RefreshCw, ShieldAlert, Smartphone, User, Wifi, WifiOff, type LucideIcon } from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import { MobilePermissionSetup } from './mobile-permission-setup'
import { PanicButton } from './panic-button'

type Person = { name?: string; phone?: string; email?: string; address?: string }

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
  vehicle: {
    id: string
    position?: { lat: number; lng: number; recorded_at: string } | { lat: number; lng: number; recorded_at: string }[] | null
  } | null
}

interface Stats {
  total: number
  online: number
  offline: number
  tracking_enabled: number
}

const PLATFORM_LABEL: Record<string, string> = { android: 'Android', ios: 'iPhone' }

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
    if (!confirm('Cerrar sesion remota y pausar rastreo en este telefono?')) return
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
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando moviles...
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rastreo movil</h1>
          <p className="text-sm text-gray-500 mt-1">Telefonos Android e iPhone como dispositivos GPS moviles</p>
          {stats && (
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <span>{stats.total} dispositivos</span>
              <span className="text-green-600 font-medium">{stats.online} en linea</span>
              <span className="text-gray-400">{stats.offline} pausados</span>
              <span>{stats.tracking_enabled} rastreando</span>
            </div>
          )}
        </div>
        <button type="button" onClick={() => void load()} className="p-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <MobilePermissionSetup onActivated={() => void load()} />

      {devices.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Sin telefonos registrados</p>
          <Link href="/devices" className="inline-block mt-4 text-orange-600 text-sm font-medium hover:underline">
            Ir a dispositivos
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => {
            const meta = d.mobile_metadata ?? {}
            const owner = readPerson(meta.device_owner)
            const responsible = readPerson(meta.responsible_contact)
            const emergency = Array.isArray(meta.emergency_contacts) ? readPerson(meta.emergency_contacts[0]) : null
            const battery = typeof meta.battery_pct === 'number' ? meta.battery_pct : null
            const position = Array.isArray(d.vehicle?.position) ? d.vehicle?.position[0] : d.vehicle?.position
            const manuallyPaused = isManualTrackingPaused(meta)
            const trackingActive = d.tracking_enabled !== false || !manuallyPaused
            const isOnline = d.status === 'online' || (trackingActive && Boolean(d.last_seen))
            const isPending = !isOnline && trackingActive && !d.last_seen
            const displayName = owner?.name || d.model
            const panicSummary = [
              owner?.name ? `Propietario: ${owner.name}${owner.phone ? ` (${owner.phone})` : ''}` : '',
              responsible?.name ? `Responsable: ${responsible.name}${responsible.phone ? ` (${responsible.phone})` : ''}` : '',
              emergency?.name ? `Emergencia: ${emergency.name}${emergency.phone ? ` (${emergency.phone})` : ''}` : '',
            ].filter(Boolean).join(' | ')

            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${d.mobile_platform === 'ios' ? 'bg-gray-100' : 'bg-green-50'}`}>
                      <Smartphone className={`w-5 h-5 ${d.mobile_platform === 'ios' ? 'text-gray-700' : 'text-green-600'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{displayName}</div>
                      <div className="text-xs text-gray-500">{d.model} · {PLATFORM_LABEL[d.mobile_platform ?? ''] ?? 'Movil'}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${isOnline ? 'bg-green-50 text-green-700' : isPending ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isOnline ? 'En linea' : isPending ? 'Pendiente' : 'Pausado'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <Info icon={User} text={owner ? `Propietario: ${owner.name}` : 'Propietario sin registrar'} />
                  {owner?.phone && <Info icon={MapPin} text={`${owner.phone}${owner.address ? ` · ${owner.address}` : ''}`} muted />}
                  {panicSummary && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{panicSummary}</span>
                    </div>
                  )}
                  <Info icon={isOnline ? Wifi : WifiOff} text={`Ultima conexion: ${d.last_seen ? new Date(d.last_seen).toLocaleString('es-MX') : 'Nunca'}`} />
                  {battery != null && <Info icon={Battery} text={`Bateria: ${battery}%`} />}
                  <div className="text-xs text-gray-400">
                    Intervalo: {d.tracking_interval_sec}s · {manuallyPaused ? 'Rastreo pausado' : 'Rastreo activo'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  {d.vehicle && <Link href={`/history?vehicle_id=${d.vehicle.id}`} className="text-xs font-medium text-orange-600 hover:text-orange-700">Historial</Link>}
                  <Link href="/map" className="text-xs font-medium text-orange-600 hover:text-orange-700">Ver en mapa</Link>
                  <Link href={`/devices/${d.id}`} className="text-xs font-medium text-teal-700 hover:text-teal-800">Editar propietario/contactos</Link>
                  <PanicButton deviceId={d.id} lat={position?.lat ?? null} lng={position?.lng ?? null} deviceName={displayName} contactSummary={panicSummary} className="h-8" />
                  {canWriteFleet && (
                    <button type="button" disabled={revoking === d.id} onClick={() => void revokeSession(d.id)} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50">
                      <Power className="w-3 h-3" />
                      {revoking === d.id ? 'Cerrando...' : 'Cerrar sesion'}
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

function Info({ icon: Icon, text, muted = false }: { icon: LucideIcon; text: string; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${muted ? 'text-xs text-gray-500' : ''}`}>
      <Icon className="w-4 h-4 text-gray-400" />
      {text}
    </div>
  )
}

function readPerson(value: unknown): Person | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return {
    name: typeof row.name === 'string' ? row.name : undefined,
    phone: typeof row.phone === 'string' ? row.phone : undefined,
    email: typeof row.email === 'string' ? row.email : undefined,
    address: typeof row.address === 'string' ? row.address : undefined,
  }
}

function isManualTrackingPaused(metadata: Record<string, unknown>): boolean {
  const reason = metadata.tracking_disabled_reason
  return typeof reason === 'string' && reason.startsWith('manual_')
}
