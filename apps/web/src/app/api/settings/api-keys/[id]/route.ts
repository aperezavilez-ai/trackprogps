import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assertPlanFeature } from '@/lib/billing/plan-guard'
import { canManageBilling } from '@/lib/auth/permissions'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !canManageBilling(profile.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const gate = await assertPlanFeature(supabase, profile.company_id, profile.role, 'api_access')
  if (gate) return gate

  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', params.id)
    .eq('company_id', profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
