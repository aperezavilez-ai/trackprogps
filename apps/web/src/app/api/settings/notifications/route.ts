import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const NotifSchema = z.object({
  notification_email: z.string().email().nullable().optional(),
  notification_phone: z.string().max(20).nullable().optional(),
  whatsapp_phone:     z.string().max(20).nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = NotifSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  // Merge into company settings JSON
  const { data: company } = await supabase.from('companies').select('settings').eq('id', profile.company_id).single()
  const current = (company?.settings ?? {}) as Record<string, unknown>

  const { data, error } = await supabase
    .from('companies')
    .update({ settings: { ...current, ...parsed.data } })
    .eq('id', profile.company_id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
