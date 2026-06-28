import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseFuelFromRawIo, estimateFuelLiters, type FuelVehicleContext } from '@/lib/map/fuel-utils'

const MAX_HOURS = 24
const DEFAULT_HOURS = 6

type Point = { lat: number; lng: number; speed: number; recorded_at: string; odometer: number }

function estimateDistanceKm(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    total += 2 * R * Math.asin(Math.sqrt(x))
  }
  return total
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hours = Math.min(
    MAX_HOURS,
    Math.max(1, parseInt(new URL(request.url).searchParams.get('hours') ?? String(DEFAULT_HOURS), 10))
  )

  const dateFrom = new Date(Date.now() - hours * 3600_000).toISOString()
  const dateTo = new Date().toISOString()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(`
      id, economic_num, plates, brand, model, year, type, fuel_efficiency_km_per_l, owner_name,
      driver:drivers(full_name, phone),
      group:vehicle_groups(name),
      device:gps_devices(id)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (!vehicle) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })

  const { data: points, error } = await supabase
    .from('position_history')
    .select('lat, lng, speed, odometer, recorded_at')
    .eq('vehicle_id', params.id)
    .gte('recorded_at', dateFrom)
    .lte('recorded_at', dateTo)
    .order('recorded_at', { ascending: true })
    .limit(8000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const track = (points ?? []).map(p => ({
    lat: p.lat,
    lng: p.lng,
    speed: p.speed,
    recorded_at: p.recorded_at,
    odometer: p.odometer,
  }))

  const { data: livePos } = await supabase
    .from('vehicle_positions')
    .select('speed, heading, ignition, odometer, recorded_at, raw_io')
    .eq('vehicle_id', params.id)
    .maybeSingle()

  const first = track[0]
  const last = track[track.length - 1]
  let distanceKm = 0
  if (first && last && last.odometer > 0 && first.odometer > 0) {
    distanceKm = Math.max(0, last.odometer - first.odometer)
  } else if (track.length > 1) {
    distanceKm = estimateDistanceKm(track)
  }
  distanceKm = Math.round(distanceKm * 10) / 10

  const fuelCtx: FuelVehicleContext = {
    type: vehicle.type,
    year: vehicle.year,
    fuel_efficiency_km_per_l: vehicle.fuel_efficiency_km_per_l,
  }
  const fuel = parseFuelFromRawIo(livePos?.raw_io as Record<string, unknown> | null)
  const fuelLitersEst = estimateFuelLiters(distanceKm, fuelCtx)

  const driver = vehicle.driver as { full_name: string; phone: string | null } | null
  const group = vehicle.group as { name: string } | null
  const device = vehicle.device as { id: string } | null

  return NextResponse.json({
    data: {
      track: track.map(({ lat, lng, speed, recorded_at }) => ({ lat, lng, speed, recorded_at })),
      hours,
      stats: {
        distance_km: distanceKm,
        fuel_liters_est: fuelLitersEst,
        fuel_level_pct: fuel.levelPct,
        point_count: track.length,
      },
      live: livePos ? {
        speed: livePos.speed,
        heading: livePos.heading,
        ignition: livePos.ignition,
        odometer: livePos.odometer,
        recorded_at: livePos.recorded_at,
      } : null,
      vehicle: {
        id: vehicle.id,
        economic_num: vehicle.economic_num,
        plates: vehicle.plates,
        brand: vehicle.brand,
        model: vehicle.model,
        owner_name: vehicle.owner_name,
        driver_name: driver?.full_name ?? null,
        driver_phone: driver?.phone ?? null,
        group_name: group?.name ?? null,
        device_id: device?.id ?? null,
      },
    },
  })
}
