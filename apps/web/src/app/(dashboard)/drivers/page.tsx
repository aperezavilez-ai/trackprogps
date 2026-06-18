import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DriversPageClient } from '@/components/fleet/drivers-page-client'
import { DEMO_MODE, isDemoTourActive } from '@/lib/demo-data'
import { normalizeDriverRow, type DriverWithUnits } from '@/lib/fleet/driver-types'

export const dynamic = 'force-dynamic'

const DEMO_DRIVERS: DriverWithUnits[] = [
  {
    id: 'dr1', full_name: 'Miguel Ángel Ramírez', phone: '+52 55 1234 5678', email: 'miguel@demo.mx',
    license_num: 'MX-A-123456', license_exp: '2026-12-31', is_active: true,
    units: [{
      id: 'v1', economic_num: 'ECO-001', plates: 'ABC-123-D', brand: 'Ford', model: 'Transit',
      device: { id: 'd1', imei: '123456789012345', model: 'FMC920', status: 'online', last_seen: new Date().toISOString() },
    }],
    unit_count: 1,
    online_count: 1,
  },
]

export default async function DriversPage({ searchParams }: { searchParams: { page?: string; search?: string } }) {
  const page    = parseInt(searchParams.page ?? '1', 10)
  const search  = searchParams.search ?? ''
  const perPage = 20

  let drivers: DriverWithUnits[] = []
  let count = 0

  if (DEMO_MODE) {
    drivers = DEMO_DRIVERS
    count = drivers.length
  } else {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('users')
      .select('company_id, company:companies(status, settings)')
      .eq('id', user.id)
      .single()

    if (isDemoTourActive(profile?.company as { status: string; settings: Record<string, unknown> | null } | null)) {
      drivers = DEMO_DRIVERS
      count = drivers.length
    } else if (profile?.role === 'super_admin' && !profile.company_id) {
      drivers = []
      count = 0
    } else {
      const offset = (page - 1) * perPage

      let query = supabase
        .from('drivers')
        .select(`
        id, full_name, phone, email, license_num, license_exp, is_active, created_at,
        vehicles(
          id, economic_num, plates, brand, model, status,
          device:gps_devices(id, imei, model, status, last_seen)
        )
      `, { count: 'exact' })
        .is('deleted_at', null)
        .order('full_name')
        .range(offset, offset + perPage - 1)

      if (search) query = query.or(`full_name.ilike.%${search}%,license_num.ilike.%${search}%,phone.ilike.%${search}%`)

      const result = await query
      drivers = (result.data ?? []).map(d => normalizeDriverRow(d as Record<string, unknown>))
      count = result.count ?? 0
    }
  }

  return (
    <DriversPageClient drivers={drivers} count={count} page={page} perPage={perPage} search={search} />
  )
}
