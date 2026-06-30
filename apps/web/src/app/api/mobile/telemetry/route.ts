import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth/get-api-user'
import { MobileTelemetrySchema } from '@/lib/mobile/schemas'
import { ensureMobileSession, resolveMobileDevice } from '@/lib/mobile/device-registry'
import { processMobileTelemetry } from '@/lib/mobile/telemetry-processor'
import { checkRateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { resolveMobileCompanyId, mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function POST(request: NextRequest) {
  const auth = await getApiUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user } = auth
  const service = createSupabaseServiceClient()

  const { data: profile } = await auth.supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let companyId: string
  try {
    companyId = await resolveMobileCompanyId(profile, service)
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const rl = checkRateLimit(`mobile-telemetry:${user.id}`, 120, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const body = await request.json()
  const parsed = MobileTelemetrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const device = await resolveMobileDevice(service, user.id, companyId, {
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
    await ensureMobileSession(service, device.deviceId, user.id)
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
    .eq('device_id', device.deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null)

  return NextResponse.json({
    data: {
      processed: result.processed,
      skipped: result.skipped,
      tracking_interval_sec: device.trackingIntervalSec,
    },
  })
}
