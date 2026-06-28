import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const tokenHash = createHash('sha256').update(params.token).digest('hex')
  const service = createSupabaseServiceClient()

  const { data: share } = await service
    .from('mobile_location_shares')
    .select('device_id, vehicle_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!share || share.revoked_at || new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Enlace expirado o inválido' }, { status: 404 })
  }

  const vehicleId = share.vehicle_id
  if (!vehicleId) {
    return NextResponse.json({ error: 'Sin ubicación disponible' }, { status: 404 })
  }

  const { data: pos } = await service
    .from('vehicle_positions')
    .select('lat, lng, speed, heading, recorded_at, raw_io')
    .eq('vehicle_id', vehicleId)
    .maybeSingle()

  const { data: vehicle } = await service
    .from('vehicles')
    .select('economic_num, plates')
    .eq('id', vehicleId)
    .maybeSingle()

  return NextResponse.json({
    data: {
      vehicle_name: vehicle ? `${vehicle.economic_num} (${vehicle.plates})` : 'Unidad móvil',
      position: pos,
      expires_at: share.expires_at,
    },
  })
}
