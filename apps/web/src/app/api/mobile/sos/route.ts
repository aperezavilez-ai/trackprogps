import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resolveMobileDevice } from '@/lib/mobile/device-registry'
import { processMobileEvent } from '@/lib/mobile/event-processor'
import { getMobileCompanyId } from '@/lib/mobile/mobile-context'
import { mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

const SosSchema = z.object({
  device_id: z.string().uuid().optional(),
  device_uid: z.string().min(8).max(64).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  battery_pct: z.number().min(0).max(100).nullable().optional(),
  payload: z.record(z.unknown()).optional(),
}).refine(d => d.device_id || d.device_uid, { message: 'device_id or device_uid required' })

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
  const parsed = SosSchema.safeParse(body)
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

  const result = await processMobileEvent(service, {
    deviceId: device.deviceId,
    vehicleId: device.vehicleId,
    companyId: device.companyId,
    userId: user.id,
    eventType: 'sos',
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    payload: {
      battery_pct: parsed.data.battery_pct,
      ...parsed.data.payload,
    },
  })

  return NextResponse.json({ data: result }, { status: 201 })
}
