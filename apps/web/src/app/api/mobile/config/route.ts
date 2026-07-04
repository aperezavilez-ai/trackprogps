import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { MobileConfigSchema } from '@/lib/mobile/schemas'
import { resolveMobileDevice } from '@/lib/mobile/device-registry'
import { MOBILE_TRACKING_INTERVALS } from '@/lib/mobile/constants'
import { getMobileCompanyId } from '@/lib/mobile/mobile-context'
import { mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('device_id')
  const deviceUid = searchParams.get('device_uid')

  const service = createSupabaseServiceClient()
  let companyId: string
  try {
    ;({ companyId } = await getMobileCompanyId(supabase, user.id, service))
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const device = await resolveMobileDevice(service, user.id, companyId, {
    deviceId: deviceId ?? undefined,
    deviceUid: deviceUid ?? undefined,
  })

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
  }

  const { data: row } = await service
    .from('gps_devices')
    .select('tracking_enabled, tracking_interval_sec, mobile_metadata')
    .eq('id', device.deviceId)
    .single()

  return NextResponse.json({
    data: {
      device_id: device.deviceId,
      vehicle_id: device.vehicleId,
      tracking_enabled: row?.tracking_enabled ?? true,
      tracking_interval_sec: row?.tracking_interval_sec ?? 30,
      allowed_intervals: MOBILE_TRACKING_INTERVALS,
      metadata: row?.mobile_metadata ?? {},
    },
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = MobileConfigSchema.safeParse(body.config ?? body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createSupabaseServiceClient()
  let companyId: string
  try {
    ;({ companyId } = await getMobileCompanyId(supabase, user.id, service))
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const device = await resolveMobileDevice(service, user.id, companyId, {
    deviceId: body.device_id,
    deviceUid: body.device_uid,
  })

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
  }

  const canAdmin = ['super_admin', 'admin_empresa', 'supervisor'].includes(profile.role)
  if (parsed.data.tracking_enabled === false && !canAdmin) {
    return NextResponse.json({ error: 'No puedes desactivar el rastreo' }, { status: 403 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.tracking_enabled !== undefined) update.tracking_enabled = parsed.data.tracking_enabled
  if (parsed.data.tracking_interval_sec !== undefined) {
    update.tracking_interval_sec = parsed.data.tracking_interval_sec
  }

  if (parsed.data.tracking_enabled !== undefined) {
    const { data: current } = await service
      .from('gps_devices')
      .select('mobile_metadata')
      .eq('id', device.deviceId)
      .single()
    const metadata = current?.mobile_metadata && typeof current.mobile_metadata === 'object' && !Array.isArray(current.mobile_metadata)
      ? current.mobile_metadata as Record<string, unknown>
      : {}

    if (parsed.data.tracking_enabled) {
      update.mobile_metadata = {
        ...metadata,
        tracking_disabled_reason: null,
        tracking_disabled_at: null,
        tracking_disabled_by: null,
      }
    } else {
      update.mobile_metadata = {
        ...metadata,
        tracking_disabled_reason: 'manual_config',
        tracking_disabled_at: new Date().toISOString(),
        tracking_disabled_by: user.id,
      }
    }
  }

  const { data, error } = await service
    .from('gps_devices')
    .update(update)
    .eq('id', device.deviceId)
    .select('tracking_enabled, tracking_interval_sec')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
