import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { AlertsFeed } from '@/components/alerts/alerts-feed'
import { RealtimeMap } from '@/components/map/realtime-map'
import { MapFilters } from '@/components/map/map-filters'
import { MaintenanceWidget } from '@/components/dashboard/maintenance-widget'
import { AlertsChart } from '@/components/dashboard/alerts-chart'
import { FleetKmWidget } from '@/components/dashboard/fleet-km-widget'
import { ToastContainer } from '@/components/ui/toast'
import { AIAssistantButton } from '@/components/ai/ai-assistant-button'
import type { DashboardStats as DashboardStatsType, LiveVehicle } from '@gps-saas/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getDashboardData(companyId: string) {
  const supabase = createSupabaseServerClient()

  const [positionsResult, alertsResult] = await Promise.all([
    supabase
      .from('vehicle_positions')
      .select(`
        vehicle_id, company_id, lat, lng, speed, heading,
        ignition, odometer, recorded_at,
        vehicle:vehicles(economic_num, plates, brand, model, driver:drivers(full_name))
      `)
      .eq('company_id', companyId),
    supabase
      .from('alerts')
      .select('*')
      .eq('company_id', companyId)
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const positions = positionsResult.data ?? []
  const alerts    = alertsResult.data ?? []
  const now       = Date.now()
  const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000

  let online = 0, moving = 0, stopped = 0, offline = 0, noSignal = 0

  const liveVehicles: LiveVehicle[] = positions.map(p => {
    const lastUpdate = new Date(p.recorded_at).getTime()
    const isOffline  = now - lastUpdate > OFFLINE_THRESHOLD_MS
    const v = p.vehicle as {
      economic_num: string; plates: string; brand: string; model: string
      driver: { full_name: string } | null
    } | null

    if (isOffline) noSignal++
    else if (!p.ignition) offline++
    else if (p.speed > 2) { online++; moving++ }
    else { online++; stopped++ }

    return {
      vehicle_id:   p.vehicle_id,
      company_id:   p.company_id,
      economic_num: v?.economic_num ?? '',
      plates:       v?.plates ?? '',
      brand:        v?.brand ?? '',
      model:        v?.model ?? '',
      driver_name:  v?.driver?.full_name ?? null,
      device_status: isOffline ? 'no_signal' : p.ignition ? 'online' : 'offline',
      lat:          p.lat,  lng:      p.lng,
      speed:        p.speed, heading:  p.heading,
      ignition:     p.ignition, odometer: p.odometer,
      last_update:  p.recorded_at,
    }
  })

  const stats: DashboardStatsType = {
    total_vehicles:     positions.length,
    vehicles_online:    online,
    vehicles_stopped:   stopped,
    vehicles_offline:   offline,
    vehicles_no_signal: noSignal,
    active_alerts:      alerts.length,
    km_today:           0,
    km_month:           0,
    productivity_today: positions.length > 0 ? Math.round((online / positions.length) * 100) : 0,
    productivity_month: 0,
  }

  return { stats, liveVehicles, alerts }
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) return null

  const { stats, liveVehicles, alerts } = await getDashboardData(profile.company_id)

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
      {/* Stats row */}
      <DashboardStats stats={stats} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map (3/4) */}
        <div className="lg:col-span-3 bg-gray-100 rounded-2xl overflow-hidden relative" style={{ minHeight: 420 }}>
          <MapFilters />
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Cargando mapa...
            </div>
          }>
            <RealtimeMap companyId={profile.company_id} initialVehicles={liveVehicles} />
          </Suspense>
        </div>

        {/* Side panel (1/4) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <AlertsFeed initialAlerts={alerts} companyId={profile.company_id} />
        </div>
      </div>

      {/* Bottom widgets row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertsChart companyId={profile.company_id} />
        <FleetKmWidget />
        <MaintenanceWidget />
      </div>

      {/* Realtime toast container */}
      <ToastContainer companyId={profile.company_id} />

      {/* AI Assistant floating button */}
      <AIAssistantButton />
    </div>
  )
}
