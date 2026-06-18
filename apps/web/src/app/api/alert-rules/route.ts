import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canManageGroups } from '@/lib/auth/permissions'
import { z } from 'zod'

const RULE_TYPES = [
  'speed_excess',
  'ignition_on',
  'ignition_off',
  'unauthorized_movement',
  'sos',
  'geofence_enter',
  'geofence_exit',
] as const

const CreateRuleSchema = z.object({
  type: z.enum(RULE_TYPES),
  name: z.string().min(2).max(100),
  is_active: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  channels: z.array(z.enum(['platform', 'email', 'whatsapp', 'push'])).min(1),
  vehicle_ids: z.array(z.string().uuid()).nullable().optional(),
})

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile?.company_id || !canManageGroups(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('alert_rules')
    .select('id, type, name, is_active, config, channels, vehicle_ids, created_at, updated_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile?.company_id || !canManageGroups(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = CreateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('alert_rules')
    .insert({
      company_id: profile.company_id,
      type: parsed.data.type,
      name: parsed.data.name,
      is_active: parsed.data.is_active ?? true,
      config: parsed.data.config ?? {},
      channels: parsed.data.channels,
      vehicle_ids: parsed.data.vehicle_ids ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
