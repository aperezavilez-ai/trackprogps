'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { APIProvider, Map, Polyline, AdvancedMarker } from '@vis.gl/react-google-maps'
import { Play, Pause, RotateCcw, Download, Car, Gauge, Clock, Navigation } from 'lucide-react'

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

interface RoutePlaybackProps {
  vehicleId: string
  vehicleName: string
  apiKey: string
  compact?: boolean
  autoLoadToday?: boolean
  initialCenter?: { lat: number; lng: number }
}

function todayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return { from: toLocal(start), to: toLocal(now) }
}

function getSpeedColor(spd: number) {
  if (spd > 100) return '#EF4444'
  if (spd > 80) return '#F97316'
  if (spd > 60) return '#EAB308'
  if (spd > 20) return '#22C55E'
  return '#6B7280'
}

function buildSpeedSegments(points: RoutePoint[]) {
  return points.reduce<Array<{ points: Array<{ lat: number; lng: number }>; color: string }>>(
    (acc, point) => {
      const color = getSpeedColor(point.speed)
      const last = acc[acc.length - 1]
      if (last && last.color === color) {
        last.points.push({ lat: point.lat, lng: point.lng })
      } else {
        acc.push({ color, points: [{ lat: point.lat, lng: point.lng }] })
      }
      return acc
    },
    []
  )
}

function headingLabel(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return dirs[idx] ?? 'N'
}

export function RoutePlayback({
  vehicleId,
  vehicleName,
  apiKey,
  compact = false,
  autoLoadToday = false,
  initialCenter = { lat: 19.4326, lng: -99.1332 },
}: RoutePlaybackProps) {
  const initial = todayRange()
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [stats, setStats] = useState<RouteStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [speed, setSpeed] = useState(10)
  const [dateFrom, setDateFrom] = useState(initial.from)
  const [dateTo, setDateTo] = useState(initial.to)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        vehicle_id: vehicleId,
        date_from: new Date(dateFrom).toISOString(),
        date_to: new Date(dateTo).toISOString(),
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

  useEffect(() => {
    if (autoLoadToday) void fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, autoLoadToday])

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

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const fullSegments = useMemo(() => buildSpeedSegments(points), [points])
  const playedSegments = useMemo(
    () => buildSpeedSegments(points.slice(0, playIndex + 1)),
    [points, playIndex]
  )

  const currentPoint = points[playIndex]
  const scrubPercent = points.length > 1 ? (playIndex / (points.length - 1)) * 100 : 0

  const exportData = () => {
    const csv = [
      'Fecha,Latitud,Longitud,Velocidad (km/h),Rumbo,Ignición',
      ...points.map(p => [
        p.recorded_at, p.lat, p.lng, p.speed, p.heading, p.ignition ? 'Sí' : 'No',
      ].join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historial-${vehicleId}-${dateFrom}.csv`
    a.click()
  }

  const mapHeight = compact
    ? 'min-h-[240px] sm:min-h-[280px]'
    : 'min-h-[50vh] sm:min-h-[400px] flex-1'

  if (!apiKey) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        Google Maps no configurado — no se puede mostrar el recorrido.
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${compact ? '' : 'h-full'}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">
          {!compact && (
            <div className="text-sm font-medium text-gray-700 w-full mb-0 sm:mb-1">{vehicleName}</div>
          )}
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={fetchHistory} disabled={isLoading || !dateFrom || !dateTo}
            className="w-full sm:w-auto bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {isLoading ? 'Cargando...' : 'Buscar ruta'}
          </button>
        </div>
      </div>

      {stats && (
        <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-3 md:grid-cols-6'}`}>
          {[
            { label: 'Distancia', value: `${stats.distance_km} km` },
            { label: 'Duración', value: `${stats.duration_min} min` },
            { label: 'Vel. máx', value: `${stats.max_speed} km/h` },
            ...(!compact ? [
              { label: 'Conduciendo', value: `${stats.driving_min} min` },
              { label: 'Detenido', value: `${stats.stopped_min} min` },
              { label: 'Vel. prom', value: `${stats.avg_speed} km/h` },
            ] : []),
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {points.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-2 sm:p-3 space-y-2 sticky top-0 z-10 sm:static">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex gap-2">
              <button onClick={reset} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Reiniciar">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={isPlaying ? pause : play}
                className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600" aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>
            <select value={speed} onChange={e => setSpeed(parseInt(e.target.value, 10))}
              className="text-xs border border-gray-300 rounded px-2 py-1">
              <option value={5}>5x</option>
              <option value={10}>10x</option>
              <option value={30}>30x</option>
              <option value={60}>60x</option>
            </select>
            <button onClick={exportData} className="p-2 rounded-lg hover:bg-gray-100 ml-auto sm:ml-0" aria-label="Exportar CSV">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="relative pt-2 pb-1">
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-500 transition-[width] duration-75"
                style={{ width: `${scrubPercent}%` }}
              />
            </div>
            <div
              className="absolute top-0 -translate-x-1/2 pointer-events-none transition-[left] duration-75"
              style={{ left: `${scrubPercent}%` }}
            >
              <div className="w-7 h-7 rounded-full bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center text-white">
                <Car className="w-3.5 h-3.5" />
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={playIndex}
              onChange={e => { pause(); setPlayIndex(parseInt(e.target.value, 10)) }}
              className="absolute inset-x-0 top-2 h-6 w-full opacity-0 cursor-pointer"
              aria-label="Posición en la ruta"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{points[0] ? new Date(points[0].recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            <span>{playIndex + 1} / {points.length}</span>
            <span>{points[points.length - 1] ? new Date(points[points.length - 1]!.recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>

          {currentPoint && (
            <div className="sm:hidden grid grid-cols-2 gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">
              <span className="font-medium">{Math.round(currentPoint.speed)} km/h</span>
              <span>{new Date(currentPoint.recorded_at).toLocaleTimeString('es-MX')}</span>
            </div>
          )}
        </div>
      )}

      <div className={`rounded-xl overflow-hidden relative ${mapHeight}`}>
        {points.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 bg-gray-900/90 backdrop-blur text-white rounded-xl px-3 py-2.5 text-xs shadow-xl max-w-[220px] pointer-events-none">
            <div className="font-semibold text-[11px] uppercase tracking-wide text-gray-300 mb-1.5">Punto actual</div>
            {currentPoint ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span className="font-semibold text-sm">{Math.round(currentPoint.speed)} km/h</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Navigation className="w-3.5 h-3.5 shrink-0" style={{ transform: `rotate(${currentPoint.heading}deg)` }} />
                  <span>{headingLabel(currentPoint.heading)} ({Math.round(currentPoint.heading)}°)</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(currentPoint.recorded_at).toLocaleString('es-MX')}</span>
                </div>
                <div className="text-gray-400 pt-0.5">
                  {currentPoint.lat.toFixed(5)}, {currentPoint.lng.toFixed(5)}
                </div>
                <div className={currentPoint.ignition ? 'text-green-400' : 'text-gray-500'}>
                  {currentPoint.ignition ? 'Motor encendido' : 'Motor apagado'}
                </div>
              </div>
            ) : (
              <span className="text-gray-400">Sin datos</span>
            )}
          </div>
        )}

        {points.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur rounded-lg px-2 py-1.5 text-[10px] shadow-md pointer-events-none hidden sm:block">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> &lt;20</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> 20–60</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 60–80</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 80–100</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;100</span>
            </div>
          </div>
        )}

        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={initialCenter}
            defaultZoom={13}
            mapId="route-playback-map"
            className="w-full h-full"
            style={{ width: '100%', height: compact ? 240 : '100%', minHeight: compact ? 240 : 280 }}
          >
            {fullSegments.map((seg, i) => (
              <Polyline key={`full-${i}`} path={seg.points} strokeColor={seg.color} strokeWeight={5} strokeOpacity={0.25} />
            ))}
            {playedSegments.map((seg, i) => (
              <Polyline key={`played-${i}`} path={seg.points} strokeColor={seg.color} strokeWeight={5} strokeOpacity={0.95} />
            ))}
            {currentPoint && (
              <AdvancedMarker position={{ lat: currentPoint.lat, lng: currentPoint.lng }}>
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-xl bg-orange-500 text-white"
                  style={{ transform: `rotate(${currentPoint.heading}deg)` }}
                >
                  <Car className="w-4 h-4" />
                </div>
              </AdvancedMarker>
            )}
            {points[0] && (
              <AdvancedMarker position={{ lat: points[0].lat, lng: points[0].lng }}>
                <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-xs font-bold">A</div>
              </AdvancedMarker>
            )}
            {points[points.length - 1] && (
              <AdvancedMarker position={{ lat: points[points.length - 1]!.lat, lng: points[points.length - 1]!.lng }}>
                <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-xs font-bold">B</div>
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  )
}
