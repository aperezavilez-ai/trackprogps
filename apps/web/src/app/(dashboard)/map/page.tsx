import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RealtimeMap } from '@/components/map/realtime-map'
import { MapFilters } from '@/components/map/map-filters'
import type { LiveVehicle } from '@gps-saas/types'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) redirect('/login')

  const { data: positions } = await supabase
    .from('vehicle_positions')
    .select(`
      vehicle_id, company_id, lat, lng, speed, heading, ignition, odometer, recorded_at,
      vehicle:vehicles(economic_num, plates, brand, model, driver:drivers(full_name))
    `)
    .eq('company_id', profile.company_id)

  const now = Date.now()
  const OFFLINE_MS = 5 * 60 * 1000

  const liveVehicles: LiveVehicle[] = (positions ?? []).map(p => {
    const v = p.vehicle as {
      economic_num: string; plates: string; brand: string; model: string
      driver: { full_name: string } | null
    } | null
    const isOffline = now - new Date(p.recorded_at).getTime() > OFFLINE_MS
    return {
      vehicle_id:   p.vehicle_id,
      company_id:   p.company_id,
      economic_num: v?.economic_num ?? '',
      plates:       v?.plates ?? '',
      brand:        v?.brand ?? '',
      model:        v?.model ?? '',
      driver_name:  v?.driver?.full_name ?? null,
      device_status: isOffline ? 'no_signal' : p.ignition ? 'online' : 'offline',
      lat:     p.lat, lng: p.lng, speed: p.speed, heading: p.heading,
      ignition: p.ignition, odometer: p.odometer, last_update: p.recorded_at,
    }
  })

  return (
    <div className="h-full relative">
      <MapFilters />
      <RealtimeMap companyId={profile.company_id} initialVehicles={liveVehicles} />
    </div>
  )
}
