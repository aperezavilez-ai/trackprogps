import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth/get-api-user'
import { MobileTelemetrySchema } from '@/lib/mobile/schemas'
import { resolveMobileDevice } from '@/lib/mobile/device-registry'
import { processMobileTelemetry } from '@/lib/mobile/telemetry-processor'

export async function POST(request: NextRequest) {
  const auth = await getApiUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user } = auth

  const { data: profile } = await auth.supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = MobileTelemetrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const service = createSupabaseServiceClient()
  const device = await resolveMobileDevice(service, user.id, profile.company_id, {
    deviceId: parsed.data.device_id,
    deviceUid: parsed.data.device_uid,
  })

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo móvil no encontrado' }, { status: 404 })
  }

  if (!device.trackingEnabled) {
    return NextResponse.json({ error: 'Rastreo deshabilitado para este dispositivo' }, { status: 403 })
  }

  const { data: session } = await service
    .from('mobile_sessions')
    .select('id, revoked_at')
    .eq('device_id', device.deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Sesión móvil revocada' }, { status: 401 })
  }

  const result = await processMobileTelemetry(service, {
    deviceId: device.deviceId,
    companyId: device.companyId,
    vehicleId: device.vehicleId,
    maxSpeed: device.maxSpeed,
  }, parsed.data.points)

  await service
    .from('mobile_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id)

  return NextResponse.json({
    data: {
      processed: result.processed,
      skipped: result.skipped,
      tracking_interval_sec: device.trackingIntervalSec,
    },
  })
}
