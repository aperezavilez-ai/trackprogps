import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseFuelFromRawIo, estimateFuelLiters, type FuelVehicleContext } from '@/lib/map/fuel-utils'
import { z } from 'zod'

const HistoryQuerySchema = z.object({
  vehicle_id: z.string().uuid(),
  date_from:  z.string().datetime(),
  date_to:    z.string().datetime(),
  simplify:   z.coerce.boolean().default(true), // reduce points for performance
})

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)

  const parsed = HistoryQuerySchema.safeParse({
    vehicle_id: searchParams.get('vehicle_id'),
    date_from:  searchParams.get('date_from'),
    date_to:    searchParams.get('date_to'),
    simplify:   searchParams.get('simplify') ?? 'true',
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { vehicle_id, date_from, date_to, simplify } = parsed.data

  const { data: vehicleRow } = await supabase
    .from('vehicles')
    .select('type, year, fuel_efficiency_km_per_l')
    .eq('id', vehicle_id)
    .is('deleted_at', null)
    .maybeSingle()

  const fuelCtx: FuelVehicleContext = {
    type: vehicleRow?.type ?? 'other',
    year: vehicleRow?.year ?? null,
    fuel_efficiency_km_per_l: vehicleRow?.fuel_efficiency_km_per_l ?? null,
  }

  // Validate date range (max 7 days for performance)
  const diffDays = (new Date(date_to).getTime() - new Date(date_from).getTime()) / 86_400_000
  if (diffDays > 7) {
    return NextResponse.json(
      { error: 'Date range cannot exceed 7 days' },
      { status: 422 }
    )
  }

  // Fetch history points
  let query = supabase
    .from('position_history')
    .select('lat, lng, speed, heading, ignition, odometer, altitude, gsm_signal, battery_lvl, satellites, raw_io, recorded_at')
    .eq('vehicle_id', vehicle_id)
    .gte('recorded_at', date_from)
    .lte('recorded_at', date_to)
    .order('recorded_at', { ascending: true })

  const { data: points, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!points?.length) {
    return NextResponse.json({ data: { points: [], stats: null } })
  }

  const processedPoints = (simplify ? simplifyPoints(points, 0.0001) : points).map(enrichPoint)

  // Calculate trip statistics
  const stats = calculateTripStats(points, fuelCtx)

  return NextResponse.json({
    data: {
      points: processedPoints,
      stats,
      fuel_profile: fuelCtx,
      total_points: points.length,
      simplified_points: processedPoints.length,
    }
  })
}

type RawPoint = {
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
  raw_io: Record<string, unknown> | null
  recorded_at: string
}

type Point = Omit<RawPoint, 'raw_io'> & {
  fuel_level_pct: number | null
}

function enrichPoint(p: RawPoint): Point {
  const { raw_io, ...rest } = p
  return {
    ...rest,
    fuel_level_pct: parseFuelFromRawIo(raw_io).levelPct,
  }
}

// Simplified Douglas-Peucker algorithm for GPS track reduction
function simplifyPoints(points: RawPoint[], tolerance: number): RawPoint[] {
  if (points.length <= 2) return points

  function perpendicularDistance(point: RawPoint, start: RawPoint, end: RawPoint): number {
    const dx = end.lng - start.lng
    const dy = end.lat - start.lat
    const length = Math.sqrt(dx * dx + dy * dy)
    if (length === 0) return 0
    return Math.abs(dy * point.lng - dx * point.lat + end.lng * start.lat - end.lat * start.lng) / length
  }

  function recurse(points: RawPoint[], start: number, end: number, tolerance: number, result: Set<number>) {
    let maxDist = 0
    let maxIdx  = 0

    for (let i = start + 1; i < end; i++) {
      const p = points[i]
      const s = points[start]
      const e = points[end]
      if (!p || !s || !e) continue
      const dist = perpendicularDistance(p, s, e)
      if (dist > maxDist) {
        maxDist = dist
        maxIdx  = i
      }
    }

    if (maxDist > tolerance) {
      result.add(maxIdx)
      recurse(points, start, maxIdx, tolerance, result)
      recurse(points, maxIdx, end, tolerance, result)
    }
  }

  const keepIndices = new Set<number>([0, points.length - 1])
  recurse(points, 0, points.length - 1, tolerance, keepIndices)

  return points.filter((_, i) => keepIndices.has(i))
}

function calculateTripStats(points: RawPoint[], fuelCtx: FuelVehicleContext) {
  if (points.length === 0) return null

  const firstPoint = points[0]!
  const lastPoint  = points[points.length - 1]!

  const speeds = points.map(p => p.speed)
  const maxSpeed = Math.max(...speeds)
  const avgSpeed = speeds.filter(s => s > 2).reduce((a, b) => a + b, 0) /
                   (speeds.filter(s => s > 2).length || 1)

  const startedAt = new Date(firstPoint.recorded_at)
  const endedAt   = new Date(lastPoint.recorded_at)
  const durationMin = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)

  // Estimate distance from odometer if available
  const distanceKm = lastPoint.odometer > 0 && firstPoint.odometer > 0
    ? lastPoint.odometer - firstPoint.odometer
    : estimateDistanceKm(points)

  // Count stopped intervals (speed < 2 km/h for >1 minute)
  let stoppedMinutes = 0
  let stoppedStart: Date | null = null

  for (const point of points) {
    if (point.speed < 2) {
      if (!stoppedStart) stoppedStart = new Date(point.recorded_at)
    } else {
      if (stoppedStart) {
        const stopDuration = (new Date(point.recorded_at).getTime() - stoppedStart.getTime()) / 60_000
        if (stopDuration > 1) stoppedMinutes += stopDuration
        stoppedStart = null
      }
    }
  }

  const distanceRounded = Math.round(distanceKm * 10) / 10

  return {
    started_at:      firstPoint.recorded_at,
    ended_at:        lastPoint.recorded_at,
    duration_min:    durationMin,
    driving_min:     durationMin - Math.round(stoppedMinutes),
    stopped_min:     Math.round(stoppedMinutes),
    distance_km:     distanceRounded,
    fuel_liters_est: estimateFuelLiters(distanceRounded, fuelCtx),
    max_speed:       Math.round(maxSpeed),
    avg_speed:       Math.round(avgSpeed),
    start_lat:       firstPoint.lat,
    start_lng:       firstPoint.lng,
    end_lat:         lastPoint.lat,
    end_lng:         lastPoint.lng,
  }
}

// Haversine formula for distance estimation
function estimateDistanceKm(points: Array<{ lat: number; lng: number }>) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const x = Math.sin(dLat / 2) ** 2 +
              Math.cos(a.lat * Math.PI / 180) *
              Math.cos(b.lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2
    total += 2 * R * Math.asin(Math.sqrt(x))
  }
  return total
}
