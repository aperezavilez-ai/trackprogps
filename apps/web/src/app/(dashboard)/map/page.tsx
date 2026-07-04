import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RealtimeMap } from '@/components/map/realtime-map'
import { MapFilters } from '@/components/map/map-filters'
import { DEMO_ALERTS, DEMO_VEHICLES, isDemoTourActive } from '@/lib/demo-data'
import type { LiveVehicle } from '@gps-saas/types'
import { SSR_POSITION_LIMIT } from '@/lib/constants/limits'

export const dynamic = 'force-dynamic'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function MapPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role, company:companies(status, settings)')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const company = firstOrNull(profile.company) as { status: string; settings: Record<string, unknown> | null } | null
  const platformOnly = profile.role === 'super_admin' && !profile.company_id
  let liveVehicles: LiveVehicle[] = []
  let activeAlerts = 0

  if (platformOnly) {
    liveVehicles = []
    activeAlerts = 0
  } else if (isDemoTourActive(company)) {
    liveVehicles = DEMO_VEHICLES
    activeAlerts = DEMO_ALERTS.length
  } else {
    const positionsQuery = supabase
      .from('vehicle_positions')
      .select(`
      vehicle_id, company_id, lat, lng, speed, heading, ignition, odometer, battery_lvl, raw_io, recorded_at,
      vehicle:vehicles(economic_num, plates, brand, model, type, owner_name, group_id, device_id, driver:drivers(full_name), group:vehicle_groups(id, name, color), device:gps_devices(source_type, mobile_platform, tracking_enabled, mobile_metadata, assigned_user:users(full_name, email, phone)))
    `)
      .is('vehicle.deleted_at', null)

    const { data: positions } = profile.company_id
      ? await positionsQuery.eq('company_id', profile.company_id).limit(SSR_POSITION_LIMIT)
      : await positionsQuery.limit(SSR_POSITION_LIMIT)
    const alertsQuery = supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .is('acknowledged_at', null)
    const { count = 0 } = profile.company_id
      ? await alertsQuery.eq('company_id', profile.company_id)
      : await alertsQuery
    activeAlerts = count ?? 0

    const now = Date.now()
    const OFFLINE_MS = 5 * 60 * 1000

    liveVehicles = (positions ?? []).map<LiveVehicle | null>(p => {
      const v = firstOrNull(p.vehicle) as {
        economic_num: string; plates: string; brand: string; model: string
        type: string
        owner_name: string | null
        group_id: string | null
        device_id: string | null
        driver: { full_name: string } | null
        group: { id: string; name: string; color: string } | null
        device: MobileDeviceMapInfo | MobileDeviceMapInfo[] | null
      } | null
      const device = firstOrNull(v?.device)
      if (!v || !v.device_id) return null
      const mobileOwnerName = readMobileOwnerName(device)
      const isOffline = now - new Date(p.recorded_at).getTime() > OFFLINE_MS
      const isMobileTracking = device?.source_type === 'mobile' && device.tracking_enabled !== false
      const effectiveOffline = isOffline
      const effectiveIgnition = !effectiveOffline && (isMobileTracking ? true : p.ignition)
      const batteryPct = readMobileBatteryPct(p.raw_io, p.battery_lvl, device?.source_type)
      return {
        vehicle_id:   p.vehicle_id,
        company_id:   p.company_id,
        device_id:    v?.device_id ?? null,
        economic_num: v?.economic_num ?? '',
        plates:       v?.plates ?? '',
        brand:        v?.brand ?? '',
        model:        v?.model ?? '',
        vehicle_type: (v?.type ?? 'other') as LiveVehicle['vehicle_type'],
        group_id:     v?.group_id ?? null,
        group_name:   v?.group?.name ?? null,
        owner_name:   mobileOwnerName ?? v?.owner_name ?? null,
        driver_name:  v?.driver?.full_name ?? null,
        device_source: (device?.source_type ?? 'hardware') as LiveVehicle['device_source'],
        mobile_platform: (device?.mobile_platform ?? null) as LiveVehicle['mobile_platform'],
        battery_pct: batteryPct,
        device_status: effectiveOffline ? 'no_signal' : effectiveIgnition ? 'online' : 'offline',
        lat:     p.lat, lng: p.lng, speed: p.speed, heading: p.heading,
        ignition: effectiveIgnition, odometer: p.odometer, last_update: p.recorded_at,
      }
    }).filter((vehicle): vehicle is LiveVehicle => vehicle !== null)
  }

  const onlineCount = liveVehicles.filter(v => v.device_status === 'online').length
  const productivity = liveVehicles.length > 0
    ? Math.round((onlineCount / liveVehicles.length) * 100)
    : 0

  return (
    <div className="h-[calc(100dvh_-_3.5rem_-_4.5rem_-_env(safe-area-inset-bottom,0px))] min-h-[360px] lg:h-full lg:min-h-0 bg-gray-100 flex flex-col">
      <MapFilters activeAlerts={activeAlerts} productivity={productivity} />
      <div className="min-h-0 flex-1">
        <RealtimeMap companyId={profile.company_id ?? 'demo-company-id'} initialVehicles={liveVehicles} />
      </div>
    </div>
  )
}

type MobileDeviceMapInfo = {
  source_type: string
  mobile_platform: string | null
  tracking_enabled: boolean | null
  mobile_metadata?: Record<string, unknown> | null
  assigned_user?: { full_name?: string | null; email?: string | null; phone?: string | null } | null
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
