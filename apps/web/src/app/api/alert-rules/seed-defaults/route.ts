import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canManageGroups } from '@/lib/auth/permissions'

const DEFAULT_RULES = [
  { type: 'speed_excess', name: 'Exceso de velocidad (100 km/h)', config: { speed_limit: 100 }, channels: ['platform', 'email'] },
  { type: 'ignition_on', name: 'Motor encendido', config: {}, channels: ['platform'] },
  { type: 'ignition_off', name: 'Motor apagado', config: {}, channels: ['platform'] },
  { type: 'unauthorized_movement', name: 'Movimiento no autorizado', config: {}, channels: ['platform', 'email'] },
] as const

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile?.company_id || !canManageGroups(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { count } = await supabase
    .from('alert_rules')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Ya existen reglas configuradas' }, { status: 409 })
  }

  const rows = DEFAULT_RULES.map(r => ({
    company_id: profile.company_id,
    type: r.type,
    name: r.name,
    is_active: true,
    config: r.config,
    channels: r.channels,
    created_by: user.id,
  }))

  const { data, error } = await supabase.from('alert_rules').insert(rows).select('id, name, type')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count: data?.length ?? 0 }, { status: 201 })
}
