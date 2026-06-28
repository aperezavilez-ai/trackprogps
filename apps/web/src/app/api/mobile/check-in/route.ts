import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { MobileCheckInSchema } from '@/lib/mobile/schemas'
import { resolveMobileDevice } from '@/lib/mobile/device-registry'
import { processMobileEvent } from '@/lib/mobile/event-processor'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = MobileCheckInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const service = createSupabaseServiceClient()
  const device = await resolveMobileDevice(service, user.id, profile.company_id, {
    deviceId: parsed.data.device_id,
    deviceUid: parsed.data.device_uid,
  })

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
  }

  const eventType = parsed.data.action_type === 'check_out'
    ? 'check_out'
    : parsed.data.action_type === 'check_in'
      ? 'check_in'
      : parsed.data.action_type

  const result = await processMobileEvent(service, {
    deviceId: device.deviceId,
    vehicleId: device.vehicleId,
    companyId: device.companyId,
    userId: user.id,
    eventType,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    payload: {
      notes: parsed.data.notes,
      media_url: parsed.data.media_url,
      action_type: parsed.data.action_type,
      ...parsed.data.metadata,
    },
  })

  return NextResponse.json({ data: result }, { status: 201 })
}
