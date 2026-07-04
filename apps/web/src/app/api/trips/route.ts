import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const vehicleId = searchParams.get('vehicle_id')
  const companyId = searchParams.get('company_id')
  const dateFrom  = searchParams.get('date_from')
  const dateTo    = searchParams.get('date_to')
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const perPage   = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10) || 20))
  const offset    = (page - 1) * perPage
  const isSuperAdmin = profile.role === 'super_admin'

  if (!isSuperAdmin && !profile.company_id) {
    return NextResponse.json({ error: 'No company associated' }, { status: 403 })
  }

  let query = supabase
    .from('trips')
    .select(`
      id, started_at, ended_at, start_lat, start_lng, end_lat, end_lng,
      start_address, end_address, distance_km, duration_min,
      avg_speed, max_speed, is_complete,
      driver:drivers(full_name)
    `, { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (isSuperAdmin) {
    if (companyId) query = query.eq('company_id', companyId)
  } else {
    query = query.eq('company_id', profile.company_id)
  }
  if (vehicleId) query = query.eq('vehicle_id', vehicleId)
  if (dateFrom)  query = query.gte('started_at', new Date(dateFrom).toISOString())
  if (dateTo)    query = query.lte('started_at', new Date(dateTo + 'T23:59:59').toISOString())

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    count,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  })
}
