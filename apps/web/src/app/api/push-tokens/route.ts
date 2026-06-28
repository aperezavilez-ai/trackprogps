import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RegisterTokenSchema = z.object({
  token:    z.string().min(1),
  platform: z.enum(['expo', 'fcm', 'apns', 'web']).default('expo'),
  device_info: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, is_active, role')
    .eq('id', user.id)
    .single()

  if (profile?.is_active === false) {
    return NextResponse.json({ error: 'Cuenta desactivada' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = RegisterTokenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  if (!profile?.company_id) {
    if (profile?.role === 'super_admin') {
      return NextResponse.json({ data: null, skipped: true }, { status: 201 })
    }
    return NextResponse.json({ error: 'Sin empresa asignada' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('push_tokens')
    .upsert({
      user_id:     user.id,
      company_id:  profile.company_id,
      token:       parsed.data.token,
      platform:    parsed.data.platform,
      device_info: parsed.data.device_info ?? null,
      is_active:   true,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'user_id,token' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  let query = supabase.from('push_tokens').update({ is_active: false }).eq('user_id', user.id)
  if (token) query = query.eq('token', token)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
