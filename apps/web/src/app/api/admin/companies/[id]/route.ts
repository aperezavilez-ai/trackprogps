import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const AdminActionSchema = z.object({
  action:  z.enum(['suspend', 'activate', 'cancel', 'change_plan']),
  plan_id: z.string().uuid().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      plan:plans(*),
      subscription:subscriptions(*),
      users(id, full_name, email, role, is_active),
      vehicles(id, economic_num, plates, status),
      gps_devices(id, imei, model, status)
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await request.json()
  const parsed = AdminActionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  const serviceClient = createSupabaseServiceClient()
  const { action, plan_id } = parsed.data

  switch (action) {
    case 'suspend':
      await serviceClient.from('companies').update({ status: 'suspended' }).eq('id', params.id)
      break

    case 'activate':
      await serviceClient.from('companies').update({ status: 'active' }).eq('id', params.id)
      await serviceClient.from('subscriptions').update({ status: 'active' }).eq('company_id', params.id)
      break

    case 'cancel':
      await serviceClient.from('companies').update({ status: 'cancelled' }).eq('id', params.id)
      await serviceClient.from('subscriptions').update({ status: 'cancelled' }).eq('company_id', params.id)
      break

    case 'change_plan':
      if (!plan_id) return NextResponse.json({ error: 'plan_id required' }, { status: 422 })
      await serviceClient.from('companies').update({ plan_id }).eq('id', params.id)
      await serviceClient.from('subscriptions').update({ plan_id }).eq('company_id', params.id)
      break
  }

  // Log audit
  await serviceClient.from('audit_logs').insert({
    user_id:    user.id,
    action:     `admin.company.${action}`,
    table_name: 'companies',
    record_id:  params.id,
    new_values: parsed.data,
  })

  return NextResponse.json({ success: true, action })
}
