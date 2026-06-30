import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { assertPlanFeature } from '@/lib/billing/plan-guard'
import { canManageBilling } from '@/lib/auth/permissions'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const WEBHOOK_EVENTS = [
  'alert.created',
  'geofence.enter',
  'geofence.exit',
  'vehicle.position_updated',
  'mobile.sos',
  '*',
] as const

const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100).default('Webhook'),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  secret: z.string().min(8).max(128).optional(),
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
    .from('webhook_endpoints')
    .select('id, name, url, events, is_active, failure_count, last_success_at, last_failure_at, created_at')
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
  const parsed = CreateWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const secret = parsed.data.secret ?? `whsec_${randomBytes(24).toString('hex')}`
  const service = createSupabaseServiceClient()

  const { data, error } = await service
    .from('webhook_endpoints')
    .insert({
      company_id: profile.company_id,
      name: parsed.data.name,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
      created_by: user.id,
    })
    .select('id, name, url, events, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    secret,
    message: 'Guarda el secret; se usa para verificar la firma HMAC.',
  }, { status: 201 })
}
