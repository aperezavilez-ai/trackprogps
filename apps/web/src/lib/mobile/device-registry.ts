import type { SupabaseClient } from '@supabase/supabase-js'
import { mobileImeiFromUid } from './constants'

type RegisterInput = {
  companyId: string
  userId: string
  deviceUid: string
  platform: 'android' | 'ios'
  brand?: string | null
  model?: string | null
  osVersion?: string | null
  appVersion?: string | null
  pushToken?: string | null
  permissions?: Record<string, boolean>
  trackingIntervalSec?: number
  label?: string
}

export type RegisteredMobileDevice = {
  device_id: string
  vehicle_id: string
  imei: string
  tracking_enabled: boolean
  tracking_interval_sec: number
  is_new: boolean
}

export async function registerOrUpdateMobileDevice(
  supabase: SupabaseClient,
  input: RegisterInput,
): Promise<RegisteredMobileDevice> {
  const imei = mobileImeiFromUid(input.deviceUid)
  const modelLabel = input.platform === 'ios' ? 'iPhone' : 'Android'
  const deviceModel = input.model ?? modelLabel
  const metadata = {
    brand: input.brand ?? null,
    model: input.model ?? null,
    os_version: input.osVersion ?? null,
    app_version: input.appVersion ?? null,
    push_token: input.pushToken ?? null,
    permissions: input.permissions ?? {},
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('gps_devices')
    .select('id, tracking_enabled, tracking_interval_sec, vehicles(id)')
    .eq('mobile_device_uid', input.deviceUid)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('gps_devices')
      .update({
        assigned_user_id: input.userId,
        mobile_platform: input.platform,
        mobile_metadata: metadata,
        model: deviceModel,
        firmware_ver: input.osVersion ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    let vehicleId = Array.isArray(existing.vehicles)
      ? existing.vehicles[0]?.id
      : (existing.vehicles as { id: string } | null)?.id

    if (!vehicleId) {
      vehicleId = await createMobileVehicle(supabase, {
        companyId: input.companyId,
        deviceId: existing.id,
        userId: input.userId,
        label: input.label,
        brand: input.brand ?? modelLabel,
        model: deviceModel,
      })
    }

    await ensureMobileSession(supabase, existing.id, input.userId)

    return {
      device_id: existing.id,
      vehicle_id: vehicleId,
      imei,
      tracking_enabled: existing.tracking_enabled,
      tracking_interval_sec: existing.tracking_interval_sec,
      is_new: false,
    }
  }

  const { data: device, error: deviceErr } = await supabase
    .from('gps_devices')
    .insert({
      company_id: input.companyId,
      imei,
      model: deviceModel,
      firmware_ver: input.osVersion ?? null,
      source_type: 'mobile',
      mobile_platform: input.platform,
      assigned_user_id: input.userId,
      mobile_device_uid: input.deviceUid,
      tracking_interval_sec: input.trackingIntervalSec ?? 30,
      tracking_enabled: true,
      mobile_metadata: metadata,
      status: 'unknown',
    })
    .select('id, tracking_enabled, tracking_interval_sec')
    .single()

  if (deviceErr || !device) {
    throw new Error(deviceErr?.message ?? 'No se pudo registrar el dispositivo móvil')
  }

  const vehicleId = await createMobileVehicle(supabase, {
    companyId: input.companyId,
    deviceId: device.id,
    userId: input.userId,
    label: input.label,
    brand: input.brand ?? modelLabel,
    model: deviceModel,
  })

  await ensureMobileSession(supabase, device.id, input.userId)

  return {
    device_id: device.id,
    vehicle_id: vehicleId,
    imei,
    tracking_enabled: device.tracking_enabled,
    tracking_interval_sec: device.tracking_interval_sec,
    is_new: true,
  }
}

async function createMobileVehicle(
  supabase: SupabaseClient,
  opts: {
    companyId: string
    deviceId: string
    userId: string
    label?: string
    brand: string
    model: string
  },
): Promise<string> {
  const { data: userRow } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', opts.userId)
    .single()

  const suffix = opts.deviceId.replace(/-/g, '').slice(0, 6).toUpperCase()
  const economicNum = (opts.label ?? `MOV-${suffix}`).slice(0, 20)
  const plates = `M-${suffix}`.slice(0, 15)
  const ownerName = userRow?.full_name ?? null

  const { data: defaultGroup } = await supabase
    .from('vehicle_groups')
    .select('id')
    .eq('company_id', opts.companyId)
    .eq('is_default', true)
    .maybeSingle()

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({
      company_id: opts.companyId,
      device_id: opts.deviceId,
      economic_num: economicNum,
      plates,
      brand: opts.brand.slice(0, 60),
      model: opts.model.slice(0, 60),
      year: new Date().getFullYear(),
      type: 'other',
      owner_name: ownerName,
      group_id: defaultGroup?.id ?? null,
      notes: 'Unidad móvil — rastreo por teléfono',
    })
    .select('id')
    .single()

  if (error || !vehicle) {
    throw new Error(error?.message ?? 'No se pudo crear vehículo móvil')
  }

  return vehicle.id
}

async function ensureMobileSession(
  supabase: SupabaseClient,
  deviceId: string,
  userId: string,
): Promise<void> {
  const { data: active } = await supabase
    .from('mobile_sessions')
    .select('id')
    .eq('device_id', deviceId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle()

  if (active) {
    await supabase
      .from('mobile_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', active.id)
    return
  }

  await supabase.from('mobile_sessions').insert({
    device_id: deviceId,
    user_id: userId,
  })
}

export async function resolveMobileDevice(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  opts: { deviceId?: string; deviceUid?: string },
) {
  let query = supabase
    .from('gps_devices')
    .select(`
      id, company_id, imei, tracking_enabled, tracking_interval_sec,
      assigned_user_id, mobile_device_uid, source_type,
      vehicles!inner(id, max_speed)
    `)
    .eq('company_id', companyId)
    .eq('source_type', 'mobile')

  if (opts.deviceId) {
    query = query.eq('id', opts.deviceId)
  } else if (opts.deviceUid) {
    query = query.eq('mobile_device_uid', opts.deviceUid)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null

  if (data.assigned_user_id !== userId) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    if (!profile || !['super_admin', 'admin_empresa', 'supervisor'].includes(profile.role)) {
      return null
    }
  }

  const vehicle = Array.isArray(data.vehicles) ? data.vehicles[0] : data.vehicles
  if (!vehicle) return null

  return {
    deviceId: data.id as string,
    companyId: data.company_id as string,
    vehicleId: (vehicle as { id: string }).id,
    maxSpeed: (vehicle as { max_speed: number }).max_speed ?? 120,
    trackingEnabled: data.tracking_enabled as boolean,
    trackingIntervalSec: data.tracking_interval_sec as number,
    imei: data.imei as string,
  }
}
