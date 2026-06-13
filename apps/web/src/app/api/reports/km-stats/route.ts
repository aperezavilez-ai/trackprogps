import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('date_from') ?? new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo   = searchParams.get('date_to')   ?? new Date().toISOString()

  const { data, error } = await supabase.rpc('get_km_stats', {
    p_company_id: profile.company_id,
    p_from:       dateFrom,
    p_to:         dateTo,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
