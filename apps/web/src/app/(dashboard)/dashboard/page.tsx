import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AlertsFeed } from '@/components/alerts/alerts-feed'
import { RealtimeMap } from '@/components/map/realtime-map'
import { MapFilters } from '@/components/map/map-filters'
import { MaintenanceWidget } from '@/components/dashboard/maintenance-widget'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import Link from 'next/link'
import { Map } from 'lucide-react'
import { AlertsChart } from '@/components/dashboard/alerts-chart'
import { FleetKmWidget } from '@/components/dashboard/fleet-km-widget'
import { ToastContainer } from '@/components/ui/toast'
import { DEMO_MODE, DEMO_STATS, DEMO_VEHICLES, DEMO_ALERTS, isDemoTourActive } from '@/lib/demo-data'
import { emptyDashboardStats } from '@/lib/auth/company-scope'
import type { DashboardStats as DashboardStatsType, LiveVehicle } from '@gps-saas/types'
import { SSR_POSITION_LIMIT } from '@/lib/constants/limits'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

async function getDashboardData(companyId: string) {
  const supabase = createSupabaseServerClient()

  let positionsQuery = supabase
    .from('vehicle_positions')
    .select(`
      vehicle_id, company_id, lat, lng, speed, heading,
      ignition, odometer, recorded_at,
      vehicle:vehicles(economic_num, plates, brand, model, type, owner_name, group_id, device_id, driver:drivers(full_name), group:vehicle_groups(id, name, color))
    `)

  let alertsQuery = supabase
    .from('alerts')
    .select('*')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  positionsQuery = positionsQuery.eq('company_id', companyId).limit(SSR_POSITION_LIMIT)
  alertsQuery = alertsQuery.eq('company_id', companyId)

  const [positionsResult, alertsResult, kmTodayResult, kmMonthResult] = await Promise.all([
    positionsQuery,
    alertsQuery,
    supabase.rpc('get_km_stats', {
      p_company_id: companyId,
      p_from: startOfToday().toISOString(),
      p_to: new Date().toISOString(),
    }),
    supabase.rpc('get_km_stats', {
      p_company_id: companyId,
      p_from: startOfMonth().toISOString(),
      p_to: new Date().toISOString(),
    }),
  ])

  const positions = positionsResult.data ?? []
  const alerts    = alertsResult.data ?? []
  const kmTodayRows = (kmTodayResult.data ?? []) as { km_total?: number }[]
  const kmMonthRows = (kmMonthResult.data ?? []) as { km_total?: number; trips_count?: number }[]
  const now       = Date.now()
  const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000

  let online = 0, moving = 0, stopped = 0, offline = 0, noSignal = 0

  const liveVehicles: LiveVehicle[] = positions.map(p => {
    const lastUpdate = new Date(p.recorded_at).getTime()
    const isOffline  = now - lastUpdate > OFFLINE_THRESHOLD_MS
    const v = firstOrNull(p.vehicle) as {
      economic_num: string; plates: string; brand: string; model: string
      type: string
      owner_name: string | null
      group_id: string | null
      device_id: string | null
      driver: { full_name: string } | null
      group: { id: string; name: string; color: string } | null
    } | null

    if (isOffline) noSignal++
    else if (!p.ignition) offline++
    else if (p.speed > 2) { online++; moving++ }
    else { online++; stopped++ }

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
      device_status: isOffline ? 'no_signal' : p.ignition ? 'online' : 'offline',
      lat:          p.lat,  lng:      p.lng,
      speed:        p.speed, heading:  p.heading,
      ignition:     p.ignition, odometer: p.odometer,
      last_update:  p.recorded_at,
    }
  })

  const kmToday = kmTodayRows.reduce((s, r) => s + (r.km_total ?? 0), 0)
  const kmMonth = kmMonthRows.reduce((s, r) => s + (r.km_total ?? 0), 0)
  const activeThisMonth = kmMonthRows.filter(r => (r.km_total ?? 0) > 0).length

  const stats: DashboardStatsType = {
    total_vehicles:     positions.length,
    vehicles_online:    online,
    vehicles_stopped:   stopped,
    vehicles_offline:   offline,
    vehicles_no_signal: noSignal,
    active_alerts:      alerts.length,
    km_today:           Math.round(kmToday),
    km_month:           Math.round(kmMonth),
    productivity_today: positions.length > 0 ? Math.round((online / positions.length) * 100) : 0,
    productivity_month: positions.length > 0 ? Math.round((activeThisMonth / positions.length) * 100) : 0,
  }

  return { stats, liveVehicles, alerts }
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function DashboardPage() {
  let stats: DashboardStatsType
  let liveVehicles: LiveVehicle[]
  let alerts: typeof DEMO_ALERTS
  let companyId: string | null

  if (DEMO_MODE) {
    stats = DEMO_STATS
    liveVehicles = DEMO_VEHICLES
    alerts = DEMO_ALERTS
    companyId = 'demo-company-id'
  } else {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('users')
      .select('company_id, role, company:companies(status, settings)')
      .eq('id', user.id)
      .single()
    if (!profile) return null

    companyId = profile.company_id
    const company = firstOrNull(profile.company) as { status: string; settings: Record<string, unknown> | null } | null
    const platformOnly = profile.role === 'super_admin' && !profile.company_id

    if (platformOnly) {
      stats = emptyDashboardStats()
      liveVehicles = []
      alerts = []
    } else if (isDemoTourActive(company)) {
      stats = DEMO_STATS
      liveVehicles = DEMO_VEHICLES
      alerts = DEMO_ALERTS
    } else if (companyId) {
      const result = await getDashboardData(companyId)
      stats = result.stats
      liveVehicles = result.liveVehicles
      alerts = result.alerts
    } else {
      stats = emptyDashboardStats()
      liveVehicles = []
      alerts = []
    }
  }

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4 p-2 sm:p-4 overflow-auto">
      {/* Móvil: Inicio sin mapa — stats, alertas y widgets */}
      <div className="lg:hidden flex flex-col gap-3">
        <DashboardStats stats={stats} />
        <Link
          href="/map"
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 px-4 text-sm font-medium shadow-md transition"
        >
          <Map className="w-4 h-4" />
          Abrir mapa en pantalla completa
        </Link>
        <div className="min-h-[320px] max-h-[45vh]">
          <AlertsFeed initialAlerts={alerts as never} companyId={companyId ?? ''} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AlertsChart companyId={companyId ?? ''} />
          <FleetKmWidget />
          <div className="sm:col-span-2">
            <MaintenanceWidget />
          </div>
        </div>
      </div>

      {/* Escritorio: mapa + panel lateral */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="order-1 lg:col-span-3 bg-gray-100 rounded-2xl overflow-hidden relative min-h-[520px]">
          <MapFilters activeAlerts={stats.active_alerts} productivity={stats.productivity_today} />
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Cargando mapa...
            </div>
          }>
            <RealtimeMap companyId={companyId ?? ''} initialVehicles={liveVehicles} />
          </Suspense>
        </div>

        <div className="order-2 lg:col-span-1 flex flex-col gap-4 max-h-none shrink-0">
          <AlertsFeed initialAlerts={alerts as never} companyId={companyId ?? ''} />
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <AlertsChart companyId={companyId ?? ''} />
        <FleetKmWidget />
        <MaintenanceWidget />
      </div>

      {companyId && <ToastContainer companyId={companyId} />}
    </div>
  )
}
