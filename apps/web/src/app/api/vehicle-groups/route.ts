import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canManageGroups } from '@/lib/auth/permissions'
import { z } from 'zod'

const CreateGroupSchema = z.object({
  name:  z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ data: [], account_type: 'business' })
  }

  const [{ data: groups, error }, { data: company }] = await Promise.all([
    supabase
      .from('vehicle_groups')
      .select('id, name, color, sort_order, is_default')
      .eq('company_id', profile.company_id)
      .order('sort_order'),
    supabase
      .from('companies')
      .select('account_type')
      .eq('id', profile.company_id)
      .single(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let groupList = groups ?? []

  if (!groupList.length && profile.company_id) {
    const defaults = [
      { company_id: profile.company_id, name: 'Particular', color: '#22C55E', sort_order: 0, is_default: true },
      { company_id: profile.company_id, name: 'Grupo',      color: '#3B82F6', sort_order: 1, is_default: false },
      { company_id: profile.company_id, name: 'Flotilla',   color: '#8B5CF6', sort_order: 2, is_default: false },
    ]
    await supabase.from('vehicle_groups').insert(defaults)
    const { data: seeded } = await supabase
      .from('vehicle_groups')
      .select('id, name, color, sort_order, is_default')
      .eq('company_id', profile.company_id)
      .order('sort_order')
    groupList = seeded ?? []
  }

  return NextResponse.json({
    data: groupList,
    account_type: company?.account_type ?? 'business',
  })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Sin empresa asignada' }, { status: 403 })
  }

  if (!canManageGroups(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = CreateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { count } = await supabase
    .from('vehicle_groups')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  const { data, error } = await supabase
    .from('vehicle_groups')
    .insert({
      company_id: profile.company_id,
      name:       parsed.data.name,
      color:      parsed.data.color ?? '#3B82F6',
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un grupo con ese nombre' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
