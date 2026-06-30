import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { MobileEventSchema } from '@/lib/mobile/schemas'
import { resolveMobileDevice } from '@/lib/mobile/device-registry'
import { processMobileEvent } from '@/lib/mobile/event-processor'
import { getMobileCompanyId } from '@/lib/mobile/mobile-context'
import { mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createSupabaseServiceClient()
  let companyId: string
  try {
    ;({ companyId } = await getMobileCompanyId(supabase, user.id, service))
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const body = await request.json()
  const parsed = MobileEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const device = await resolveMobileDevice(service, user.id, companyId, {
    deviceId: parsed.data.device_id,
    deviceUid: parsed.data.device_uid,
  })

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
  }

  try {
    const result = await processMobileEvent(service, {
      deviceId: device.deviceId,
      vehicleId: device.vehicleId,
      companyId: device.companyId,
      userId: user.id,
      eventType: parsed.data.event_type,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      payload: parsed.data.payload,
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al procesar evento' },
      { status: 500 },
    )
  }
}
