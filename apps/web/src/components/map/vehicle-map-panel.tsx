'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, User, Fuel, Route, Gauge, Clock, Wifi } from 'lucide-react'

export interface VehiclePanelData {
  vehicleId: string
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  lastUpdate: string
  economicNum: string
  plates: string
  driverName?: string | null
  ownerName?: string | null
  groupName?: string | null
  deviceId?: string | null
}

interface TrackStats {
  distance_km: number
  fuel_liters_est: number
  fuel_level_pct: number | null
  point_count: number
}

interface Props {
  vehicle: VehiclePanelData
  onClose: () => void
}

export function VehicleMapPanel({ vehicle, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TrackStats | null>(null)
  const [driverName, setDriverName] = useState<string | null>(vehicle.driverName ?? null)

  const clientName = driverName || vehicle.ownerName || 'Sin cliente asignado'

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/vehicles/${vehicle.vehicleId}/track?hours=6`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        setStats(json.data?.stats ?? null)
        if (json.data?.vehicle?.driver_name) {
          setDriverName(json.data.vehicle.driver_name)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [vehicle.vehicleId])

  const timeLabel = formatTimeAgo(vehicle.lastUpdate)

  return (
    <div className="vehicle-map-panel w-full sm:w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/25 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-white overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-medium uppercase tracking-wide mb-1">
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            Cliente
          </div>
          <div className="font-semibold text-base leading-tight truncate">{clientName}</div>
          <div className="text-sm text-white/80 mt-1 truncate">
            {vehicle.economicNum} — {vehicle.plates}
          </div>
          {vehicle.groupName && (
            <div className="text-xs text-white/50 mt-0.5">{vehicle.groupName}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-2.5 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <InfoRow
            icon={Wifi}
            label="Estado"
            value={vehicle.ignition ? 'Encendido' : 'Apagado'}
            valueClass={vehicle.ignition ? 'text-green-400' : 'text-white/50'}
          />
          <InfoRow
            icon={Gauge}
            label="Velocidad"
            value={`${Math.round(vehicle.speed)} km/h`}
          />
        </div>

        <InfoRow icon={Clock} label="Última actualización" value={timeLabel} />

        {loading ? (
          <p className="text-xs text-white/40 py-1">Cargando recorrido…</p>
        ) : stats ? (
          <>
            <InfoRow
              icon={Route}
              label={`Recorrido (${stats.point_count > 0 ? '6 h' : 'sin datos'})`}
              value={stats.distance_km > 0 ? `${stats.distance_km} km` : '—'}
            />
            <InfoRow
              icon={Fuel}
              label={stats.fuel_level_pct != null ? 'Nivel combustible' : 'Consumo estimado'}
              value={
                stats.fuel_level_pct != null
                  ? `${stats.fuel_level_pct}%`
                  : stats.fuel_liters_est > 0
                    ? `~${stats.fuel_liters_est} L`
                    : '—'
              }
            />
            {stats.fuel_level_pct != null && stats.fuel_liters_est > 0 && (
              <p className="text-xs text-white/45 pl-6">
                Consumo estimado del trayecto: ~{stats.fuel_liters_est} L
              </p>
            )}
          </>
        ) : null}
      </div>

      <div className="px-4 pb-4 flex flex-wrap gap-2">
        {vehicle.deviceId && (
          <Link
            href={`/devices/${vehicle.deviceId}`}
            className="text-xs font-medium text-blue-300 hover:text-blue-200"
          >
            Ver dispositivo GPS →
          </Link>
        )}
        <Link
          href={`/history?vehicle_id=${vehicle.vehicleId}&lat=${vehicle.lat}&lng=${vehicle.lng}`}
          className="text-xs font-medium text-blue-300 hover:text-blue-200"
        >
          Historial completo →
        </Link>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass = 'text-white',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-start gap-2 col-span-2 sm:col-span-1">
      <Icon className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-white/50">{label}</div>
        <div className={`font-medium ${valueClass}`}>{value}</div>
      </div>
    </div>
  )
}

function formatTimeAgo(iso: string) {
  const secondsAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secondsAgo < 60) return `Hace ${secondsAgo}s`
  if (secondsAgo < 3600) return `Hace ${Math.floor(secondsAgo / 60)} min`
  if (secondsAgo < 86400) return `Hace ${Math.floor(secondsAgo / 3600)} h`
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}
