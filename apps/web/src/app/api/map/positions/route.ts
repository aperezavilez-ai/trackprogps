import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SSR_POSITION_LIMIT } from '@/lib/constants/limits'
import type { LiveVehicle } from '@gps-saas/types'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

type MobileDeviceMapInfo = {
  source_type: string
  mobile_platform: string | null
  tracking_enabled: boolean | null
  mobile_metadata?: Record<string, unknown> | null
  assigned_user?: { full_name?: string | null; email?: string | null; phone?: string | null } | null
}

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role !== 'super_admin' && !profile.company_id) {
    return NextResponse.json({ error: 'No company associated' }, { status: 403 })
  }

  let query = supabase
    .from('vehicle_positions')
    .select(`
      vehicle_id, company_id, lat, lng, speed, heading, ignition, odometer, battery_lvl, raw_io, recorded_at,
      vehicle:vehicles(economic_num, plates, brand, model, type, owner_name, group_id, device_id, driver:drivers(full_name), group:vehicle_groups(id, name, color), device:gps_devices(source_type, mobile_platform, tracking_enabled, mobile_metadata, assigned_user:users(full_name, email, phone)))
    `)
    .is('vehicle.deleted_at', null)
    .limit(SSR_POSITION_LIMIT)

  if (profile.company_id) query = query.eq('company_id', profile.company_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const OFFLINE_MS = 5 * 60 * 1000

  const vehicles = (data ?? []).map<LiveVehicle | null>(p => {
    const vehicle = firstOrNull(p.vehicle) as {
      economic_num: string
      plates: string
      brand: string
      model: string
      type: LiveVehicle['vehicle_type']
      owner_name: string | null
      group_id: string | null
      device_id: string | null
      driver: { full_name: string } | null
      group: { id: string; name: string; color: string } | null
      device: MobileDeviceMapInfo | MobileDeviceMapInfo[] | null
    } | null
    const device = firstOrNull(vehicle?.device)
    if (!vehicle || !vehicle.device_id) return null

    const isOffline = now - new Date(p.recorded_at).getTime() > OFFLINE_MS
    const isMobileTracking = device?.source_type === 'mobile' && isTrackingActive(device)
    const effectiveOffline = isOffline
    const effectiveIgnition = !effectiveOffline && (isMobileTracking ? true : p.ignition)
    const mobileOwnerName = readMobileOwnerName(device)

    return {
      vehicle_id: p.vehicle_id,
      company_id: p.company_id,
      device_id: vehicle.device_id,
      economic_num: vehicle.economic_num ?? '',
      plates: vehicle.plates ?? '',
      brand: vehicle.brand ?? '',
      model: vehicle.model ?? '',
      vehicle_type: vehicle.type ?? 'other',
      group_id: vehicle.group_id ?? null,
      group_name: vehicle.group?.name ?? null,
      owner_name: mobileOwnerName ?? vehicle.owner_name ?? null,
      driver_name: vehicle.driver?.full_name ?? null,
      device_source: (device?.source_type ?? 'hardware') as LiveVehicle['device_source'],
      mobile_platform: (device?.mobile_platform ?? null) as LiveVehicle['mobile_platform'],
      battery_pct: readMobileBatteryPct(p.raw_io, p.battery_lvl, device?.source_type),
      device_status: effectiveOffline ? 'no_signal' : effectiveIgnition ? 'online' : 'offline',
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
      heading: p.heading,
      ignition: effectiveIgnition,
      odometer: p.odometer,
      last_update: p.recorded_at,
    }
  }).filter((vehicle): vehicle is LiveVehicle => vehicle !== null)

  return NextResponse.json({ data: vehicles, server_at: new Date().toISOString() })
}

function isTrackingActive(device: MobileDeviceMapInfo) {
  if (device.tracking_enabled !== false) return true
  const reason = device.mobile_metadata?.tracking_disabled_reason
  return !(typeof reason === 'string' && reason.startsWith('manual_'))
}

function readMobileOwnerName(device: MobileDeviceMapInfo | null | undefined) {
  const owner = device?.mobile_metadata?.device_owner
  if (owner && typeof owner === 'object' && !Array.isArray(owner)) {
    const name = (owner as { name?: unknown }).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return device?.assigned_user?.full_name?.trim() || device?.assigned_user?.email?.trim() || null
}

function readMobileBatteryPct(rawIo: unknown, batteryLvl: number | null | undefined, sourceType?: string | null) {
  if (sourceType !== 'mobile') return batteryLvl ?? null
  if (rawIo && typeof rawIo === 'object' && !Array.isArray(rawIo)) {
    const value = (rawIo as Record<string, unknown>).battery_pct
    if (typeof value === 'number') return value
  }
  return null
}
