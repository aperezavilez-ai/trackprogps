'use client'

import { useState, useCallback, useRef } from 'react'
import { APIProvider, Map, Polyline, AdvancedMarker } from '@vis.gl/react-google-maps'
import { Play, Pause, RotateCcw, Download } from 'lucide-react'

interface RoutePoint {
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  recorded_at: string
}

interface RouteStats {
  started_at: string
  ended_at: string
  duration_min: number
  driving_min: number
  stopped_min: number
  distance_km: number
  max_speed: number
  avg_speed: number
}

interface RouteHistoryMapProps {
  vehicleId: string
  vehicleName: string
  apiKey: string
}

export function RouteHistoryMap({ vehicleId, vehicleName, apiKey }: RouteHistoryMapProps) {
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [stats, setStats]   = useState<RouteStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [speed, setSpeed]   = useState(10) // 10x real time
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        vehicle_id: vehicleId,
        date_from:  new Date(dateFrom).toISOString(),
        date_to:    new Date(dateTo).toISOString(),
      })

      const res = await fetch(`/api/history?${params}`)
      const json = await res.json()

      setPoints(json.data?.points ?? [])
      setStats(json.data?.stats ?? null)
      setPlayIndex(0)
    } finally {
      setIsLoading(false)
    }
  }, [vehicleId, dateFrom, dateTo])

  const play = useCallback(() => {
    setIsPlaying(true)
    intervalRef.current = setInterval(() => {
      setPlayIndex(prev => {
        if (prev >= points.length - 1) {
          setIsPlaying(false)
          if (intervalRef.current) clearInterval(intervalRef.current)
          return prev
        }
        return prev + 1
      })
    }, 1000 / speed)
  }, [points.length, speed])

  const pause = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const reset = useCallback(() => {
    pause()
    setPlayIndex(0)
  }, [pause])

  // Color polyline by speed
  const getSpeedColor = (speed: number) => {
    if (speed > 100) return '#EF4444' // red — very fast
    if (speed > 80)  return '#F97316' // orange
    if (speed > 60)  return '#EAB308' // yellow
    if (speed > 20)  return '#22C55E' // green
    return '#6B7280'                  // gray — stopped/slow
  }

  // Build colored segments
  const segments = points.slice(0, playIndex + 1).reduce<
    Array<{ points: Array<{ lat: number; lng: number }>; color: string }>
  >((acc, point, i) => {
    const color = getSpeedColor(point.speed)
    const last  = acc[acc.length - 1]

    if (last && last.color === color) {
      last.points.push({ lat: point.lat, lng: point.lng })
    } else {
      acc.push({
        color,
        points: [{ lat: point.lat, lng: point.lng }],
      })
    }
    return acc
  }, [])

  const currentPoint = points[playIndex]
  const exportData = () => {
    const csv = [
      'Fecha,Latitud,Longitud,Velocidad (km/h),Rumbo,Ignición',
      ...points.map(p => [
        p.recorded_at, p.lat, p.lng, p.speed, p.heading, p.ignition ? 'Sí' : 'No'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `historial-${vehicleId}-${dateFrom}.csv`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={fetchHistory}
            disabled={isLoading || !dateFrom || !dateTo}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Cargando...' : 'Buscar ruta'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Distancia',    value: `${stats.distance_km} km` },
            { label: 'Duración',     value: `${stats.duration_min} min` },
            { label: 'Conduciendo',  value: `${stats.driving_min} min` },
            { label: 'Detenido',     value: `${stats.stopped_min} min` },
            { label: 'Vel. máx',     value: `${stats.max_speed} km/h` },
            { label: 'Vel. prom',    value: `${stats.avg_speed} km/h` },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Playback controls */}
      {points.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-4">
          <div className="flex gap-2">
            <button onClick={reset} className="p-2 rounded-lg hover:bg-gray-100">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? pause : play}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={playIndex}
            onChange={e => {
              pause()
              setPlayIndex(parseInt(e.target.value, 10))
            }}
            className="flex-1"
          />

          <span className="text-xs text-gray-500 whitespace-nowrap">
            {playIndex + 1} / {points.length}
          </span>

          <select
            value={speed}
            onChange={e => setSpeed(parseInt(e.target.value, 10))}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value={5}>5x</option>
            <option value={10}>10x</option>
            <option value={30}>30x</option>
            <option value={60}>60x</option>
          </select>

          <button onClick={exportData} className="p-2 rounded-lg hover:bg-gray-100">
            <Download className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Speed legend */}
      <div className="flex gap-3 text-xs text-gray-500 items-center">
        <span>Velocidad:</span>
        {[
          { color: '#6B7280', label: '<20' },
          { color: '#22C55E', label: '20-60' },
          { color: '#EAB308', label: '60-80' },
          { color: '#F97316', label: '80-100' },
          { color: '#EF4444', label: '>100 km/h' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden min-h-[400px]">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={{ lat: 19.4326, lng: -99.1332 }}
            defaultZoom={13}
            mapId="route-history-map"
          >
            {segments.map((seg, i) => (
              <Polyline
                key={i}
                path={seg.points}
                strokeColor={seg.color}
                strokeWeight={4}
                strokeOpacity={0.9}
              />
            ))}

            {/* Current position marker */}
            {currentPoint && (
              <AdvancedMarker
                position={{ lat: currentPoint.lat, lng: currentPoint.lng }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
                  style={{
                    background:    currentPoint.ignition ? '#22C55E' : '#6B7280',
                    transform:     `rotate(${currentPoint.heading}deg)`,
                  }}
                />
              </AdvancedMarker>
            )}

            {/* Start and end markers */}
            {points[0] && (
              <AdvancedMarker position={{ lat: points[0].lat, lng: points[0].lng }}>
                <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-xs font-bold">
                  A
                </div>
              </AdvancedMarker>
            )}
            {points[points.length - 1] && playIndex === points.length - 1 && (
              <AdvancedMarker
                position={{ lat: points[points.length - 1]!.lat, lng: points[points.length - 1]!.lng }}
              >
                <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-xs font-bold">
                  B
                </div>
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  )
}
