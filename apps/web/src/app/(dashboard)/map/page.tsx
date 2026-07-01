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
      vehicle_id, company_id, lat, lng, speed, heading, ignition, odometer, battery_lvl, recorded_at,
      vehicle:vehicles(economic_num, plates, brand, model, type, owner_name, group_id, device_id, driver:drivers(full_name), group:vehicle_groups(id, name, color), device:gps_devices(source_type, mobile_platform))
    `)

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

    liveVehicles = (positions ?? []).map(p => {
      const v = firstOrNull(p.vehicle) as {
        economic_num: string; plates: string; brand: string; model: string
        type: string
        owner_name: string | null
        group_id: string | null
        device_id: string | null
        driver: { full_name: string } | null
        group: { id: string; name: string; color: string } | null
        device: { source_type: string; mobile_platform: string | null } | { source_type: string; mobile_platform: string | null }[] | null
      } | null
      const device = firstOrNull(v?.device)
      const isOffline = now - new Date(p.recorded_at).getTime() > OFFLINE_MS
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
        owner_name:   v?.owner_name ?? null,
        driver_name:  v?.driver?.full_name ?? null,
        device_source: (device?.source_type ?? 'hardware') as LiveVehicle['device_source'],
        mobile_platform: (device?.mobile_platform ?? null) as LiveVehicle['mobile_platform'],
        battery_pct: p.battery_lvl ?? null,
        device_status: isOffline ? 'no_signal' : p.ignition ? 'online' : 'offline',
        lat:     p.lat, lng: p.lng, speed: p.speed, heading: p.heading,
        ignition: p.ignition, odometer: p.odometer, last_update: p.recorded_at,
      }
    })
  }

  const onlineCount = liveVehicles.filter(v => v.device_status === 'online').length
  const productivity = liveVehicles.length > 0
    ? Math.round((onlineCount / liveVehicles.length) * 100)
    : 0

  return (
    <div className="h-[calc(100dvh-3.5rem-4rem)] lg:h-full lg:min-h-0 bg-gray-100 flex flex-col">
      <MapFilters activeAlerts={activeAlerts} productivity={productivity} />
      <div className="min-h-0 flex-1">
        <RealtimeMap companyId={profile.company_id ?? 'demo-company-id'} initialVehicles={liveVehicles} />
      </div>
    </div>
  )
}
