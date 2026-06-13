import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page      = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage   = parseInt(searchParams.get('per_page') ?? '50', 10)
  const severity  = searchParams.get('severity')
  const type      = searchParams.get('type')
  const unackOnly = searchParams.get('unacknowledged') === 'true'
  const dateFrom  = searchParams.get('date_from')
  const dateTo    = searchParams.get('date_to')
  const offset    = (page - 1) * perPage

  let query = supabase
    .from('alerts')
    .select(`
      *,
      vehicle:vehicles(economic_num, plates, brand, model),
      acknowledged_by_user:users!acknowledged_by(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (severity)  query = query.eq('severity', severity)
  if (type)      query = query.eq('type', type)
  if (unackOnly) query = query.is('acknowledged_at', null)
  if (dateFrom)  query = query.gte('created_at', dateFrom)
  if (dateTo)    query = query.lte('created_at', dateTo)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) })
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alert_ids } = await request.json() as { alert_ids: string[] }
  if (!alert_ids?.length) return NextResponse.json({ error: 'alert_ids required' }, { status: 422 })

  const { error } = await supabase
    .from('alerts')
    .update({ acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
    .in('id', alert_ids)
    .is('acknowledged_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, acknowledged: alert_ids.length })
}
