import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/scope'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const superAdmin = isSuperAdmin(profile)

  let companiesQuery = supabase
    .from('companies')
    .select('id, name')
    .neq('status', 'cancelled')
    .order('name')

  if (!superAdmin && profile.company_id) {
    companiesQuery = companiesQuery.eq('id', profile.company_id)
  }

  let driversQuery = supabase
    .from('drivers')
    .select('id, full_name, company_id, company:companies(name)')
    .is('deleted_at', null)
    .order('full_name')

  if (!superAdmin && profile.company_id) {
    driversQuery = driversQuery.eq('company_id', profile.company_id)
  }

  let vehiclesQuery = supabase
    .from('vehicles')
    .select('id, economic_num, plates, driver_id, company_id, company:companies(name)')
    .is('deleted_at', null)
    .order('economic_num')

  if (!superAdmin && profile.company_id) {
    vehiclesQuery = vehiclesQuery.eq('company_id', profile.company_id)
  }

  const [companiesRes, driversRes, vehiclesRes] = await Promise.all([
    companiesQuery,
    driversQuery,
    vehiclesQuery,
  ])

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 })
  if (driversRes.error) return NextResponse.json({ error: driversRes.error.message }, { status: 500 })
  if (vehiclesRes.error) return NextResponse.json({ error: vehiclesRes.error.message }, { status: 500 })

  return NextResponse.json({
    is_super_admin: superAdmin,
    companies: companiesRes.data ?? [],
    drivers: driversRes.data ?? [],
    vehicles: vehiclesRes.data ?? [],
  })
}
