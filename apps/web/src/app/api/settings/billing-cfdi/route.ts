import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('company_id, role').eq('id', user.id).single()

  if (!profile?.company_id || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  const { data: company } = await supabase
    .from('companies').select('settings').eq('id', profile.company_id).single()

  const settings = (company?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from('companies')
    .update({
      settings: { ...settings, billing_cfdi: body },
      rfc: body.rfc ?? undefined,
    })
    .eq('id', profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
