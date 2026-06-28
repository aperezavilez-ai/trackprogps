import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/scope'
import { getUserGroupAccessMap } from '@/lib/auth/group-access'
import { getPlatformInternalCompanyId } from '@/lib/auth/platform-team'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filterCompany = searchParams.get('company_id')
  const scope = searchParams.get('scope')

  let query = supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at, last_sign_in_at, company:companies(id, name)')
    .order('created_at', { ascending: false })

  if (isSuperAdmin(profile)) {
    if (scope === 'internal') {
      const serviceClient = createSupabaseServiceClient()
      const platformCompanyId = await getPlatformInternalCompanyId(serviceClient)
      if (platformCompanyId) {
        query = query.or(`company_id.is.null,company_id.eq.${platformCompanyId}`)
      } else {
        query = query.is('company_id', null)
      }
    } else if (filterCompany) {
      query = query.eq('company_id', filterCompany)
    }
  } else {
    query = query.eq('company_id', profile.company_id!)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const groupMap = await getUserGroupAccessMap(supabase, (data ?? []).map(u => u.id))
  const enriched = (data ?? []).map(u => ({
    ...u,
    group_access: groupMap.get(u.id) ?? [],
  }))

  return NextResponse.json({ data: enriched })
}
