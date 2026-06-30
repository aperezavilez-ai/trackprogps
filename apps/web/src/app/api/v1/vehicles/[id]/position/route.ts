import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  authenticateApiKey,
  apiRateLimitHeaders,
  requirePermission,
} from '@/lib/api/api-key-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof NextResponse) return auth

  const denied = requirePermission(auth, 'read')
  if (denied) return denied

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('vehicle_positions')
    .select(`
      lat, lng, speed, heading, altitude, ignition, odometer,
      gsm_signal, battery_lvl, satellites, recorded_at, server_at,
      vehicle:vehicles!inner(id, economic_num, plates, company_id)
    `)
    .eq('vehicle_id', params.id)
    .eq('vehicle.company_id', auth.companyId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Vehicle or position not found' } }, { status: 404 })
  }

  const vehicle = Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle

  return NextResponse.json(
    {
      data: {
        vehicle_id: vehicle?.id ?? params.id,
        economic_num: (vehicle as { economic_num?: string })?.economic_num,
        plates: (vehicle as { plates?: string })?.plates,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: data.heading,
        altitude: data.altitude,
        ignition: data.ignition,
        odometer: data.odometer,
        gsm_signal: data.gsm_signal,
        battery_lvl: data.battery_lvl,
        satellites: data.satellites,
        recorded_at: data.recorded_at,
        server_at: data.server_at,
      },
    },
    { headers: apiRateLimitHeaders(auth, auth.rateLimitRemaining) },
  )
}
