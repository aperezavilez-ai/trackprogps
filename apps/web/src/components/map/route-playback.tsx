'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { APIProvider, Map, Polyline, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { Play, Pause, RotateCcw, Download, Car, Fuel, Battery, Signal, Satellite, MapPin, Clock, Smartphone } from 'lucide-react'
import { estimateFuelLiters, type FuelVehicleContext } from '@/lib/map/fuel-utils'

interface RoutePoint {
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  odometer: number
  altitude: number | null
  gsm_signal: number
  battery_lvl: number
  satellites: number | null
  fuel_level_pct: number | null
  recorded_at: string
}

interface RouteStats {
  started_at: string
  ended_at: string
  duration_min: number
  driving_min: number
  stopped_min: number
  distance_km: number
  fuel_liters_est?: number
  max_speed: number
  avg_speed: number
}

interface RouteStop {
  id: string
  lat: number
  lng: number
  started_at: string
  ended_at: string
  duration_min: number
  point_count: number
}

interface RoutePlaybackProps {
  vehicleId: string
  vehicleName: string
  apiKey: string
  compact?: boolean
  autoLoadToday?: boolean
  initialCenter?: { lat: number; lng: number }
  deviceSource?: 'mobile' | 'hardware'
}

const SPEED_PRESETS = [
  { label: 'Lento', value: 8 },
  { label: 'Rápido', value: 28 },
  { label: 'Super rápido', value: 90 },
] as const

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

function buildSpeedSegments(points: Array<{ lat: number; lng: number; speed: number }>) {
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
    [],
  )
}

function headingLabel(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return dirs[idx] ?? 'N'
}

function formatStopRange(stop: RouteStop) {
  const format = (value: string) => new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${format(stop.started_at)} - ${format(stop.ended_at)}`
}

function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + 540) % 360) - 180
  return (a + diff * t + 360) % 360
}

function interpolatePoint(points: RoutePoint[], progress: number): RoutePoint | null {
  if (!points.length) return null
  if (points.length === 1) return points[0]!
  const clamped = Math.max(0, Math.min(progress, points.length - 1))
  const i = Math.floor(clamped)
  const j = Math.min(i + 1, points.length - 1)
  const t = clamped - i
  const a = points[i]!
  const b = points[j]!
  if (i === j || t <= 0) return a
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    speed: a.speed + (b.speed - a.speed) * t,
    heading: lerpAngle(a.heading, b.heading, t),
    ignition: t < 0.5 ? a.ignition : b.ignition,
    odometer: a.odometer + (b.odometer - a.odometer) * t,
    altitude: a.altitude != null && b.altitude != null
      ? a.altitude + (b.altitude - a.altitude) * t
      : a.altitude ?? b.altitude,
    gsm_signal: Math.round(a.gsm_signal + (b.gsm_signal - a.gsm_signal) * t),
    battery_lvl: Math.round(a.battery_lvl + (b.battery_lvl - a.battery_lvl) * t),
    satellites: a.satellites ?? b.satellites,
    fuel_level_pct: a.fuel_level_pct ?? b.fuel_level_pct,
    recorded_at: t < 0.5 ? a.recorded_at : b.recorded_at,
  }
}

function MapFollowVehicle({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    map.panTo({ lat, lng })
  }, [map, lat, lng])
  return null
}

function VehicleInfoTooltip({
  vehicleName,
  point,
  pointIndex,
  totalPoints,
  segmentKm,
  fuelProfile,
  compact,
  isMobile,
}: {
  vehicleName: string
  point: RoutePoint
  pointIndex: number
  totalPoints: number
  segmentKm: number
  fuelProfile: FuelVehicleContext | null
  compact?: boolean
  isMobile: boolean
}) {
  const fuelEst = segmentKm > 0 ? estimateFuelLiters(segmentKm, fuelProfile) : null

  return (
    <div
      className={`relative mt-1.5 rounded-xl border border-white/70 bg-white/88 backdrop-blur-md shadow-lg text-gray-800 pointer-events-none ${
        compact ? 'px-2.5 py-2 min-w-[180px] max-w-[220px] text-[10px]' : 'px-3 py-2.5 min-w-[210px] max-w-[280px] text-xs'
      }`}
    >
      <div className="font-semibold text-gray-900 truncate border-b border-gray-200/80 pb-1.5 mb-1.5">
        {vehicleName}
      </div>
      <div className="space-y-1">
        <Row label="Velocidad" value={`${Math.round(point.speed)} km/h`} highlight />
        {!isMobile && <Row
          label="Combustible"
          value={
            point.fuel_level_pct != null
              ? `${point.fuel_level_pct}%`
              : fuelEst != null && fuelEst > 0
                ? `~${fuelEst} L (est.)`
                : '—'
          }
          icon={<Fuel className="w-3 h-3 text-orange-500" />}
        />}
        <Row label="Rumbo" value={`${headingLabel(point.heading)} (${Math.round(point.heading)}°)`} />
        <Row
          label="Fecha / hora"
          value={new Date(point.recorded_at).toLocaleString('es-MX', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        />
        <Row
          label={isMobile ? 'Movimiento' : 'Motor'}
          value={isMobile ? (point.speed > 1 ? 'En movimiento' : 'Detenido') : (point.ignition ? 'Encendido' : 'Apagado')}
          valueClass={point.ignition ? 'text-green-600' : 'text-gray-500'}
        />
        {point.odometer > 0 && (
          <Row label="Odómetro" value={`${Math.round(point.odometer).toLocaleString('es-MX')} km`} />
        )}
        {point.altitude != null && point.altitude !== 0 && (
          <Row label="Altitud" value={`${Math.round(point.altitude)} m`} />
        )}
        <Row
          label={isMobile ? 'Senal movil' : 'Señal GSM'}
          value={`${point.gsm_signal}%`}
          icon={<Signal className="w-3 h-3 text-blue-500" />}
        />
        <Row
          label={isMobile ? 'Bateria movil' : 'Batería GPS'}
          value={`${point.battery_lvl}%`}
          icon={<Battery className="w-3 h-3 text-emerald-600" />}
        />
        {point.satellites != null && point.satellites > 0 && (
          <Row label="Satélites" value={String(point.satellites)} icon={<Satellite className="w-3 h-3 text-violet-500" />} />
        )}
        <Row label="Coordenadas" value={`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`} muted />
        <Row label="Punto" value={`${pointIndex + 1} / ${totalPoints}`} muted />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
  muted,
  valueClass,
  icon,
}: {
  label: string
  value: string
  highlight?: boolean
  muted?: boolean
  valueClass?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`shrink-0 ${muted ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-right flex items-center gap-1 ${highlight ? 'font-bold text-orange-600' : ''} ${valueClass ?? (muted ? 'text-gray-500' : 'text-gray-800 font-medium')}`}>
        {icon}
        {value}
      </span>
    </div>
  )
}

function PlaybackMapContent({
  points,
  stops,
  playProgress,
  playedCount,
  vehicleName,
  compact,
  segmentKm,
  fuelProfile,
  selectedStopId,
  onSelectStop,
  isMobile,
}: {
  points: RoutePoint[]
  stops: RouteStop[]
  playProgress: number
  playedCount: number
  vehicleName: string
  compact?: boolean
  segmentKm: number
  fuelProfile: FuelVehicleContext | null
  selectedStopId: string | null
  onSelectStop: (stop: RouteStop) => void
  isMobile: boolean
}) {
  const currentPoint = interpolatePoint(points, playProgress)
  const playedPoints = points.slice(0, playedCount + 1)
  const fullSegments = useMemo(() => buildSpeedSegments(points), [points])
  const playedSegments = useMemo(() => buildSpeedSegments(playedPoints), [playedPoints])
  const pointIndex = Math.round(playProgress)

  if (!currentPoint) return null

  return (
    <>
      <MapFollowVehicle lat={currentPoint.lat} lng={currentPoint.lng} />
      {fullSegments.map((seg, i) => (
        <Polyline key={`full-${i}`} path={seg.points} strokeColor={seg.color} strokeWeight={5} strokeOpacity={0.2} />
      ))}
      {playedSegments.map((seg, i) => (
        <Polyline key={`played-${i}`} path={seg.points} strokeColor={seg.color} strokeWeight={5} strokeOpacity={0.95} />
      ))}
      {points[0] && (
        <AdvancedMarker position={{ lat: points[0].lat, lng: points[0].lng }}>
          <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">A</div>
        </AdvancedMarker>
      )}
      {points[points.length - 1] && (
        <AdvancedMarker position={{ lat: points[points.length - 1]!.lat, lng: points[points.length - 1]!.lng }}>
          <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">B</div>
        </AdvancedMarker>
      )}
      {stops.map((stop, index) => (
        <AdvancedMarker key={stop.id} position={{ lat: stop.lat, lng: stop.lng }}>
          <button
            type="button"
            onClick={() => onSelectStop(stop)}
            className={`w-7 h-7 rounded-full border-2 shadow-lg flex items-center justify-center text-[11px] font-bold transition ${
              selectedStopId === stop.id
                ? 'bg-blue-600 text-white border-white scale-110'
                : 'bg-white text-blue-700 border-blue-500 hover:bg-blue-50'
            }`}
            title={`Parada ${index + 1}: ${stop.duration_min} min`}
          >
            {index + 1}
          </button>
        </AdvancedMarker>
      ))}
      <AdvancedMarker position={{ lat: currentPoint.lat, lng: currentPoint.lng }}>
        <div className="flex flex-col items-center">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-white shadow-xl bg-orange-500 text-white transition-transform duration-100"
            style={{ transform: `rotate(${currentPoint.heading}deg)` }}
          >
            {isMobile ? <Smartphone className="w-5 h-5" /> : <Car className="w-5 h-5" />}
          </div>
          <VehicleInfoTooltip
            vehicleName={vehicleName}
            point={currentPoint}
            pointIndex={pointIndex}
            totalPoints={points.length}
            segmentKm={segmentKm}
            fuelProfile={fuelProfile}
            compact={compact}
            isMobile={isMobile}
          />
        </div>
      </AdvancedMarker>
    </>
  )
}

export function RoutePlayback({
  vehicleId,
  vehicleName,
  apiKey,
  compact = false,
  autoLoadToday = false,
  initialCenter = { lat: 19.4326, lng: -99.1332 },
  deviceSource = 'hardware',
}: RoutePlaybackProps) {
  const initial = todayRange()
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [stops, setStops] = useState<RouteStop[]>([])
  const [stats, setStats] = useState<RouteStats | null>(null)
  const [fuelProfile, setFuelProfile] = useState<FuelVehicleContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [speedPreset, setSpeedPreset] = useState<number>(SPEED_PRESETS[1].value)
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(initial.from)
  const [dateTo, setDateTo] = useState(initial.to)
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)

  const fetchHistory = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setIsLoading(true)
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    try {
      const params = new URLSearchParams({
        vehicle_id: vehicleId,
        date_from: new Date(dateFrom).toISOString(),
        date_to: new Date(dateTo).toISOString(),
      })
      const res = await fetch(`/api/history?${params}`)
      const json = await res.json()
      const loaded: RoutePoint[] = (json.data?.points ?? []).map((p: RoutePoint) => ({
        ...p,
        altitude: p.altitude ?? null,
        gsm_signal: p.gsm_signal ?? 0,
        battery_lvl: p.battery_lvl ?? 0,
        satellites: p.satellites ?? null,
        fuel_level_pct: p.fuel_level_pct ?? null,
      }))
      setPoints(loaded)
      setStops(json.data?.fixed_locations ?? [])
      setStats(json.data?.stats ?? null)
      setFuelProfile(json.data?.fuel_profile ?? null)
      setPlayProgress(0)
      setSelectedStopId(null)
    } finally {
      setIsLoading(false)
    }
  }, [vehicleId, dateFrom, dateTo])

  const loadToday = useCallback(async () => {
    const range = todayRange()
    setDateFrom(range.from)
    setDateTo(range.to)
    setIsLoading(true)
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    try {
      const params = new URLSearchParams({
        vehicle_id: vehicleId,
        date_from: new Date(range.from).toISOString(),
        date_to: new Date(range.to).toISOString(),
      })
      const res = await fetch(`/api/history?${params}`)
      const json = await res.json()
      const loaded: RoutePoint[] = (json.data?.points ?? []).map((p: RoutePoint) => ({
        ...p,
        altitude: p.altitude ?? null,
        gsm_signal: p.gsm_signal ?? 0,
        battery_lvl: p.battery_lvl ?? 0,
        satellites: p.satellites ?? null,
        fuel_level_pct: p.fuel_level_pct ?? null,
      }))
      setPoints(loaded)
      setStops(json.data?.fixed_locations ?? [])
      setStats(json.data?.stats ?? null)
      setFuelProfile(json.data?.fuel_profile ?? null)
      setPlayProgress(0)
      setSelectedStopId(null)
    } finally {
      setIsLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    if (autoLoadToday) void fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, autoLoadToday])

  const pause = useCallback(() => {
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const reset = useCallback(() => {
    pause()
    setPlayProgress(0)
  }, [pause])

  useEffect(() => {
    if (!isPlaying || points.length < 2) return

    lastFrameRef.current = performance.now()

    const tick = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000
      lastFrameRef.current = now

      setPlayProgress(prev => {
        const next = prev + dt * speedPreset * 0.35
        if (next >= points.length - 1) {
          setIsPlaying(false)
          return points.length - 1
        }
        return next
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, points.length, speedPreset])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const play = useCallback(() => {
    if (points.length < 2) return
    if (playProgress >= points.length - 1) setPlayProgress(0)
    setIsPlaying(true)
  }, [points.length, playProgress])

  const playedCount = Math.floor(playProgress)
  const scrubPercent = points.length > 1 ? (playProgress / (points.length - 1)) * 100 : 0
  const segmentKm = stats?.distance_km ?? 0
  const isMobile = deviceSource === 'mobile'

  const jumpToStop = useCallback((stop: RouteStop) => {
    pause()
    setSelectedStopId(stop.id)
    if (!points.length) return

    const targetTime = (
      new Date(stop.started_at).getTime() + new Date(stop.ended_at).getTime()
    ) / 2

    let bestIndex = 0
    let bestDelta = Number.POSITIVE_INFINITY
    points.forEach((point, index) => {
      const delta = Math.abs(new Date(point.recorded_at).getTime() - targetTime)
      if (delta < bestDelta) {
        bestDelta = delta
        bestIndex = index
      }
    })

    setPlayProgress(bestIndex)
  }, [pause, points])

  const exportData = () => {
    const csv = [
      'Fecha,Latitud,Longitud,Velocidad (km/h),Rumbo,Ignición,Odómetro,Combustible %,GSM %,Batería %,Satélites',
      ...points.map(p => [
        p.recorded_at, p.lat, p.lng, p.speed, p.heading, p.ignition ? 'Sí' : 'No',
        p.odometer, p.fuel_level_pct ?? '', p.gsm_signal, p.battery_lvl, p.satellites ?? '',
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
    ? 'min-h-[280px] sm:min-h-[320px]'
    : 'min-h-[50vh] sm:min-h-[420px] flex-1'

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
          <button type="button" onClick={loadToday}
            className="w-full sm:w-auto border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Hoy
          </button>
          <button type="button" onClick={fetchHistory} disabled={isLoading || !dateFrom || !dateTo}
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
            ...(!isMobile && stats.fuel_liters_est != null && stats.fuel_liters_est > 0
              ? [{ label: 'Combustible est.', value: `~${stats.fuel_liters_est} L` }]
              : []),
            ...(!compact ? [
              { label: isMobile ? 'Movimiento' : 'Conduciendo', value: `${stats.driving_min} min` },
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
              <button type="button" onClick={reset} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Reiniciar">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button type="button" onClick={isPlaying ? pause : play}
                className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600" aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {SPEED_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSpeedPreset(p.value)}
                  className={`px-2.5 py-1.5 font-medium transition ${
                    speedPreset === p.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={exportData} className="p-2 rounded-lg hover:bg-gray-100 ml-auto sm:ml-0" aria-label="Exportar CSV">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="relative pt-2 pb-1">
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-orange-500 transition-[width] duration-75" style={{ width: `${scrubPercent}%` }} />
            </div>
            <div
              className="absolute top-0 -translate-x-1/2 pointer-events-none transition-[left] duration-75"
              style={{ left: `${scrubPercent}%` }}
            >
              <div className="w-7 h-7 rounded-full bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center text-white">
                {isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, points.length - 1)}
              step={0.01}
              value={playProgress}
              onChange={e => { pause(); setPlayProgress(parseFloat(e.target.value)) }}
              className="absolute inset-x-0 top-2 h-6 w-full opacity-0 cursor-pointer"
              aria-label="Posición en la ruta"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{points[0] ? new Date(points[0].recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            <span>{Math.round(playProgress) + 1} / {points.length}</span>
            <span>{points[points.length - 1] ? new Date(points[points.length - 1]!.recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
        </div>
      )}

      {points.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Ubicaciones fijas</div>
                <div className="text-xs text-gray-500">
                  {stops.length ? `${stops.length} paradas detectadas` : 'Sin paradas mayores a 10 min'}
                </div>
              </div>
            </div>
          </div>

          {stops.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
              {stops.map((stop, index) => (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => jumpToStop(stop)}
                  className={`min-w-[180px] text-left border rounded-lg p-2.5 transition ${
                    selectedStopId === stop.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">Parada {index + 1}</span>
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">
                      {stop.duration_min} min
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatStopRange(stop)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`rounded-xl overflow-hidden relative ${mapHeight}`}>
        {points.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur rounded-lg px-2 py-1.5 text-[10px] text-gray-600 shadow-md pointer-events-none hidden sm:block">
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
            defaultZoom={14}
            mapId="route-playback-map"
            gestureHandling="greedy"
            className="w-full h-full"
            style={{ width: '100%', height: compact ? 280 : '100%', minHeight: compact ? 280 : 320 }}
          >
            {points.length > 0 && (
              <PlaybackMapContent
                points={points}
                stops={stops}
                playProgress={playProgress}
                playedCount={playedCount}
                vehicleName={vehicleName}
                compact={compact}
                segmentKm={segmentKm}
                fuelProfile={fuelProfile}
                selectedStopId={selectedStopId}
                onSelectStop={jumpToStop}
                isMobile={isMobile}
              />
            )}
          </Map>
        </APIProvider>

        {points.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 text-sm text-gray-500">
            Selecciona fechas y pulsa Buscar ruta
          </div>
        )}
      </div>
    </div>
  )
}
