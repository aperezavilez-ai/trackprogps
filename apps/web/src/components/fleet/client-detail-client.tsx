'use client'

import Link from 'next/link'
import {
  Plus, Pencil, Radio, Truck, MapPin, Wifi, WifiOff, ExternalLink,
} from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'

interface UnitDevice {
  id: string
  imei: string
  model: string
  status: string
  last_seen: string | null
}

interface Unit {
  id: string
  economic_num: string
  plates: string
  brand: string
  model: string
  year: number
  color: string | null
  status: string
  device: UnitDevice | null
  position: { lat: number; lng: number; speed: number; ignition: boolean; recorded_at: string } | null
}

interface GeofenceInfo {
  id: string
  name: string
  color: string
  is_active: boolean
  vehicle_ids: string[] | null
}

interface Props {
  driverId: string
  driverName: string
  units: Unit[]
  geofences: GeofenceInfo[]
  vehicleIds: string[]
}

const STATUS_LABEL: Record<string, string> = {
  online: 'En línea',
  offline: 'Desconectado',
  no_signal: 'Sin señal',
  unknown: 'Desconocido',
}

export function ClientDetailClient({ driverId, driverName, units, geofences, vehicleIds }: Props) {
  const { canWriteFleet } = usePermissions()

  const clientGeofences = geofences.filter(f => {
    if (f.vehicle_ids === null) return true
    return f.vehicle_ids.some(vid => vehicleIds.includes(vid))
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-orange-500" />
          Unidades ({units.length})
        </h2>
        {canWriteFleet && (
          <Link
            href={`/drivers/${driverId}/add-unit`}
            className="flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600"
          >
            <Plus className="w-4 h-4" /> Agregar unidad
          </Link>
        )}
      </div>

      {units.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center mb-6">
          <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">Este cliente no tiene unidades registradas</p>
          {canWriteFleet && (
            <Link
              href={`/drivers/${driverId}/add-unit`}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600"
            >
              <Plus className="w-4 h-4" /> Instalar primera unidad
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {units.map(unit => {
            const dev = unit.device
            const online = dev?.status === 'online'
            return (
              <div key={unit.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{unit.economic_num}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-medium text-orange-500">{unit.plates}</span>
                      <span className="text-sm text-gray-500">{unit.brand} {unit.model} {unit.year}</span>
                    </div>

                    {dev ? (
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <Radio className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{dev.model}</span>
                        <span className="font-mono text-xs text-gray-500">{dev.imei}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          online ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
                        }`}>
                          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {STATUS_LABEL[dev.status] ?? dev.status}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">Sin GPS asignado</p>
                    )}

                    {unit.position && (
                      <p className="text-xs text-gray-500 mt-2">
                        Última posición: {Math.round(unit.position.speed)} km/h ·{' '}
                        {new Date(unit.position.recorded_at).toLocaleString('es-MX')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {unit.position && (
                      <a
                        href={`https://www.google.com/maps?q=${unit.position.lat},${unit.position.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-orange-500 px-3 py-2 border border-gray-200 rounded-lg hover:border-orange-200"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Mapa
                      </a>
                    )}
                    {dev && (
                      <Link
                        href={`/devices/${dev.id}`}
                        className="flex items-center gap-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-lg font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Control GPS
                      </Link>
                    )}
                    <Link
                      href={`/vehicles?search=${encodeURIComponent(unit.plates)}`}
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-orange-500 px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Vehículo
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            Geocercas aplicadas
          </h2>
          {canWriteFleet && (
            <Link href="/geofences" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
              Gestionar geocercas →
            </Link>
          )}
        </div>

        {clientGeofences.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No hay geocercas específicas para las unidades de {driverName}
          </p>
        ) : (
          <div className="space-y-2">
            {clientGeofences.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <span className="text-sm font-medium text-gray-900">{f.name}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  f.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {f.is_active ? 'Activa' : 'Inactiva'}
                </span>
                {f.vehicle_ids === null && (
                  <span className="text-xs text-gray-400">Toda la flota</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
