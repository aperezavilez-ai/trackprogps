import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { canAccessCompany, getActorProfile, hasRole, writeAuditLog } from '@/lib/security/server-guards'
import { DeviceOwnerSchema } from '@/lib/mobile/schemas'

const MANAGE_DEVICE_ROLES = ['super_admin', 'admin_empresa', 'supervisor']

const DevicePatchSchema = z.object({
  imei:         z.string().length(15).regex(/^\d+$/, 'IMEI must be 15 digits').optional(),
  model:        z.string().max(50).optional(),
  firmware_ver: z.string().max(20).nullable().optional(),
  sim_iccid:    z.string().max(30).nullable().optional(),
  phone_num:    z.string().max(20).nullable().optional(),
  assigned_user_id: z.string().uuid().nullable().optional(),
  tracking_interval_sec: z.number().int().min(5).max(3600).optional(),
  mobile_details: z.object({
    brand: z.string().max(60).nullable().optional(),
    model: z.string().max(60).nullable().optional(),
    os_version: z.string().max(30).nullable().optional(),
    app_version: z.string().max(20).nullable().optional(),
    device_notes: z.string().max(1000).nullable().optional(),
  }).optional(),
  protocol_details: z.record(z.unknown()).optional(),
  device_owner: DeviceOwnerSchema.optional(),
  responsible_contact: z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(7).max(30),
    email: z.string().email().max(160).nullable().optional(),
  }).optional(),
  emergency_contacts: z.array(z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(7).max(30),
    email: z.string().email().max(160).nullable().optional(),
    relationship: z.string().max(60).nullable().optional(),
    priority: z.number().int().min(1).max(5).optional(),
  })).max(5).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('gps_devices')
    .select(`
      *,
      company:companies(id, name),
      vehicle:vehicles(
        id, economic_num, plates, brand, model, status, max_speed,
        driver:drivers(id, full_name, phone, email),
        position:vehicle_positions(lat, lng, speed, heading, ignition, odometer, gsm_signal, battery_lvl, satellites, raw_io, recorded_at)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actor = await getActorProfile(supabase, user.id)
  if (!hasRole(actor, MANAGE_DEVICE_ROLES)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { data: device, error: deviceError } = await supabase
    .from('gps_devices')
    .select('id, company_id, source_type, mobile_metadata, protocol_metadata')
    .eq('id', params.id)
    .single()

  if (deviceError || !device) {
    return NextResponse.json({ error: deviceError?.message ?? 'Device not found' }, { status: 404 })
  }

  if (!canAccessCompany(actor!, device.company_id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = DevicePatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  const {
    device_owner,
    responsible_contact,
    emergency_contacts,
    mobile_details,
    protocol_details,
    ...deviceFields
  } = parsed.data
  const updatePayload: Record<string, unknown> = {
    ...deviceFields,
    updated_at: new Date().toISOString(),
  }

  if (device_owner || responsible_contact || emergency_contacts || mobile_details || protocol_details) {
    const metadataKey = device.source_type === 'mobile' ? 'mobile_metadata' : 'protocol_metadata'
    const existingMetadata = device.source_type === 'mobile'
      ? device.mobile_metadata
      : device.protocol_metadata
    const metadata = existingMetadata && typeof existingMetadata === 'object' && !Array.isArray(existingMetadata)
      ? existingMetadata as Record<string, unknown>
      : {}

    updatePayload[metadataKey] = {
      ...metadata,
      ...(device.source_type === 'mobile' && mobile_details ? mobile_details : {}),
      ...(device.source_type !== 'mobile' && protocol_details ? protocol_details : {}),
      ...(device_owner ? { device_owner } : {}),
      ...(responsible_contact ? { responsible_contact } : {}),
      ...(emergency_contacts ? { emergency_contacts } : {}),
    }
  }

  const { data, error } = await supabase
    .from('gps_devices')
    .update(updatePayload)
    .eq('id', params.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog(supabase, {
    companyId: device.company_id,
    userId: user.id,
    action: 'device.update',
    tableName: 'gps_devices',
    recordId: params.id,
    oldValues: device,
    newValues: parsed.data,
    request,
  })
  return NextResponse.json({ data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !MANAGE_DEVICE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const service = createSupabaseServiceClient()
  const { data: device, error: deviceError } = await service
    .from('gps_devices')
    .select('id, company_id')
    .eq('id', params.id)
    .single()

  if (deviceError || !device) {
    return NextResponse.json({ error: deviceError?.message ?? 'Device not found' }, { status: 404 })
  }

  if (profile.role !== 'super_admin' && device.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const cleanupSteps = [
    service.from('vehicles').update({ device_id: null, updated_at: now }).eq('device_id', params.id),
    service.from('vehicle_positions').update({ device_id: null }).eq('device_id', params.id),
    service.from('position_history').update({ device_id: null }).eq('device_id', params.id),
  ]

  for (const step of cleanupSteps) {
    const { error } = await step
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error } = await service.from('gps_devices').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog(service, {
    companyId: device.company_id,
    userId: user.id,
    action: 'device.delete',
    tableName: 'gps_devices',
    recordId: params.id,
    oldValues: device,
    request: _request,
  })
  return NextResponse.json({ success: true })
}
