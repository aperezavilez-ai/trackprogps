import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { assertPlanFeature } from '@/lib/billing/plan-guard'
import { canManageBilling } from '@/lib/auth/permissions'
import { generateApiKey } from '@/lib/api/api-key-auth'
import { z } from 'zod'

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).default(['read']),
  expires_at: z.string().datetime().nullable().optional(),
})

export async function GET() {
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

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, permissions, last_used, expires_at, is_active, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null)
  const parsed = CreateKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { key, prefix, hash } = generateApiKey()
  const service = createSupabaseServiceClient()

  const { data, error } = await service
    .from('api_keys')
    .insert({
      company_id: profile.company_id,
      name: parsed.data.name,
      key_hash: hash,
      key_prefix: prefix,
      permissions: parsed.data.permissions,
      expires_at: parsed.data.expires_at ?? null,
      created_by: user.id,
    })
    .select('id, name, key_prefix, permissions, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    key,
    prefix,
    message: 'Guarda esta clave ahora; no se volverá a mostrar.',
  }, { status: 201 })
}
