import { createSupabaseServerClient } from '@/lib/supabase/server'
import { VehiclesPageClient } from '@/components/fleet/vehicles-page-client'
import { DEMO_MODE, DEMO_VEHICLES_TABLE, isDemoTourActive } from '@/lib/demo-data'

export const dynamic = 'force-dynamic'

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; status?: string; group?: string }
}) {
  const page    = parseInt(searchParams.page ?? '1', 10)
  const search  = searchParams.search ?? ''
  const status  = searchParams.status ?? ''
  const group   = searchParams.group ?? ''
  const perPage = 20

  let vehicles: typeof DEMO_VEHICLES_TABLE = []
  let count = 0

  let groups: { id: string; name: string; color: string }[] = []

  if (DEMO_MODE) {
    vehicles = DEMO_VEHICLES_TABLE
    count = vehicles.length
  } else {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('users')
      .select('company_id, role, company:companies(status, settings)')
      .eq('id', user.id)
      .single()

    if (isDemoTourActive(profile?.company as { status: string; settings: Record<string, unknown> | null } | null)) {
      vehicles = DEMO_VEHICLES_TABLE
      count = vehicles.length
    } else if (profile.role === 'super_admin' && !profile.company_id) {
      vehicles = []
      count = 0
    } else if (profile?.company_id) {
      const { data: groupRows } = await supabase
        .from('vehicle_groups')
        .select('id, name, color')
        .eq('company_id', profile.company_id)
        .order('sort_order')
      groups = groupRows ?? []

      const offset = (page - 1) * perPage

      let query = supabase
        .from('vehicles')
        .select(`
        *,
        device:gps_devices(id, imei, model, status, last_seen),
        driver:drivers(id, full_name, phone),
        group:vehicle_groups(id, name, color)
      `, { count: 'exact' })
        .is('deleted_at', null)
        .order('economic_num')
        .range(offset, offset + perPage - 1)

      query = query.eq('company_id', profile.company_id)
      if (search) query = query.or(`economic_num.ilike.%${search}%,plates.ilike.%${search}%,brand.ilike.%${search}%`)
      if (status) query = query.eq('status', status)
      if (group) query = query.eq('group_id', group)

      const result = await query
      const rows = result.data ?? []

      const ids = rows.map(v => v.id)
      const { data: positions } = ids.length
        ? await supabase
            .from('vehicle_positions')
            .select('vehicle_id, lat, lng, speed, ignition, recorded_at')
            .in('vehicle_id', ids)
        : { data: [] }

      const posMap = new Map((positions ?? []).map(p => [p.vehicle_id, p]))

      vehicles = rows.map(v => ({
        ...v,
        position: posMap.get(v.id) ?? null,
      })) as typeof DEMO_VEHICLES_TABLE

      count = result.count ?? 0
    }
  }

  return (
    <VehiclesPageClient
      vehicles={vehicles}
      groups={groups}
      count={count}
      page={page}
      perPage={perPage}
      search={search}
      status={status}
      group={group}
    />
  )
}
