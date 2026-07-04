'use client'

import { useState, useEffect, useCallback } from 'react'
import { Route, Calendar, Clock, Gauge, MapPin, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'

interface Trip {
  id: string
  started_at: string
  ended_at: string | null
  start_address: string | null
  end_address: string | null
  start_lat: number
  start_lng: number
  end_lat: number | null
  end_lng: number | null
  distance_km: number
  duration_min: number
  avg_speed: number
  max_speed: number
  is_complete: boolean
  driver: { full_name: string } | null
}

interface TripsResponse {
  data: Trip[]
  count: number
  page: number
  per_page: number
  total_pages: number
}

interface Vehicle {
  id: string
  economic_num: string
  plates: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(minutes: number) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

export default function TripsPage() {
  const [trips, setTrips]       = useState<Trip[]>([])
  const [count, setCount]       = useState(0)
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]   = useState(true)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  const [vehicleId, setVehicleId] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const fetchVehicles = useCallback(async () => {
    const res = await fetch('/api/vehicles?per_page=200')
    if (res.ok) {
      const json = await res.json()
      setVehicles(json.data ?? [])
    }
  }, [])

  const fetchTrips = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), per_page: '20' })
    if (vehicleId) params.set('vehicle_id', vehicleId)
    if (dateFrom)  params.set('date_from', dateFrom)
    if (dateTo)    params.set('date_to', dateTo)

    const res = await fetch(`/api/trips?${params}`)
    if (res.ok) {
      const json: TripsResponse = await res.json()
      setTrips(json.data ?? [])
      setCount(json.count ?? 0)
      setTotalPages(json.total_pages ?? 1)
      setPage(json.page)
    }
    setLoading(false)
  }, [vehicleId, dateFrom, dateTo])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])
  useEffect(() => { fetchTrips(1) }, [fetchTrips])

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    fetchTrips(1)
  }

  async function exportCsv() {
    const params = new URLSearchParams({ per_page: '1000' })
    if (vehicleId) params.set('vehicle_id', vehicleId)
    if (dateFrom)  params.set('date_from', dateFrom)
    if (dateTo)    params.set('date_to', dateTo)

    const res = await fetch(`/api/trips?${params}`)
    if (!res.ok) return
    const json: TripsResponse = await res.json()

    const rows = [
      ['Inicio', 'Fin', 'Origen', 'Destino', 'Distancia (km)', 'Duración', 'Vel. Promedio', 'Vel. Máxima', 'Conductor', 'Completo'],
      ...(json.data ?? []).map(t => [
        formatDate(t.started_at),
        t.ended_at ? formatDate(t.ended_at) : '',
        t.start_address ?? `${t.start_lat},${t.start_lng}`,
        t.end_address   ?? (t.end_lat ? `${t.end_lat},${t.end_lng}` : ''),
        t.distance_km?.toFixed(2) ?? '0',
        formatDuration(t.duration_min),
        t.avg_speed ? `${t.avg_speed.toFixed(1)} km/h` : '',
        t.max_speed ? `${t.max_speed.toFixed(1)} km/h` : '',
        t.driver?.full_name ?? '',
        t.is_complete ? 'Sí' : 'No',
      ]),
    ]

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `viajes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Route className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Registro de Viajes</h1>
            <p className="text-sm text-gray-500">{count} viajes encontrados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchTrips(page)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={handleFilter} className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehículo</label>
            <select
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los vehículos</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.economic_num} — {v.plates}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Route className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">Sin viajes registrados</p>
            <p className="text-sm mt-1">Ajusta los filtros o espera a que los vehículos registren viajes</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Inicio</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Fin</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Origen → Destino</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Dist.</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Duración</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Vel. Prom.</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Vel. Máx.</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Conductor</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trips.map(trip => (
                    <tr key={trip.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {formatDate(trip.started_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {trip.ended_at ? formatDate(trip.ended_at) : (
                          <span className="text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded-full">En curso</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-700 text-xs truncate">
                            <MapPin className="h-3 w-3 inline mr-1 text-green-500" />
                            {trip.start_address ?? `${trip.start_lat.toFixed(5)}, ${trip.start_lng.toFixed(5)}`}
                          </span>
                          {trip.end_address || trip.end_lat ? (
                            <span className="text-gray-500 text-xs truncate">
                              <MapPin className="h-3 w-3 inline mr-1 text-red-500" />
                              {trip.end_address ?? `${trip.end_lat?.toFixed(5)}, ${trip.end_lng?.toFixed(5)}`}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {trip.distance_km?.toFixed(1) ?? '—'} km
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {formatDuration(trip.duration_min)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Gauge className="h-3 w-3 text-blue-400" />
                          {trip.avg_speed?.toFixed(0) ?? '—'} km/h
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-medium ${trip.max_speed > 100 ? 'text-red-600' : 'text-gray-700'}`}>
                          {trip.max_speed?.toFixed(0) ?? '—'} km/h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {trip.driver?.full_name ?? <span className="text-gray-400 italic text-xs">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trip.is_complete ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Completo</span>
                        ) : (
                          <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">Incompleto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {trips.map(trip => (
                <div key={trip.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900">{formatDate(trip.started_at)}</div>
                    {trip.is_complete ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Completo</span>
                    ) : (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">En curso</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-2 truncate">
                    {trip.start_address ?? `${trip.start_lat.toFixed(4)}, ${trip.start_lng.toFixed(4)}`}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <div className="font-bold text-gray-900">{trip.distance_km?.toFixed(1) ?? '—'}</div>
                      <div className="text-gray-500">km</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <div className="font-bold text-gray-900">{formatDuration(trip.duration_min)}</div>
                      <div className="text-gray-500">duración</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <div className={`font-bold ${trip.max_speed > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                        {trip.max_speed?.toFixed(0) ?? '—'}
                      </div>
                      <div className="text-gray-500">km/h máx</div>
                    </div>
                  </div>
                  {trip.driver?.full_name && (
                    <div className="mt-2 text-xs text-gray-500">Conductor: {trip.driver.full_name}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">
              Página {page} de {totalPages} — {count} viajes
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchTrips(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => fetchTrips(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
