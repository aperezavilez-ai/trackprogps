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
  const daysAhead = parseInt(searchParams.get('days_ahead') ?? '30', 10)

  const { data, error } = await supabase.rpc('get_upcoming_maintenance', {
    p_company_id: profile.company_id,
    p_days_ahead: daysAhead,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
