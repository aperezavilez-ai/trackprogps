import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { canAccessSupportInbox, getSupportActor } from '@/lib/auth/support-access'
import { z } from 'zod'

const PatchSchema = z.object({
  status: z.enum(['nuevo', 'en_proceso', 'respondido', 'cerrado']).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const actor = await getSupportActor(supabase, user.id)
  if (!canAccessSupportInbox(actor)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  const service = createSupabaseServiceClient()

  const { data: ticket, error } = await service
    .from('support_tickets')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  const { data: messages } = await service
    .from('support_messages')
    .select('id, body, is_staff, author_user_id, created_at, author:users(full_name)')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: true })

  if (ticket.status === 'nuevo') {
    await service
      .from('support_tickets')
      .update({ status: 'en_proceso' })
      .eq('id', params.id)
    ticket.status = 'en_proceso'
  }

  return NextResponse.json({
    data: {
      ticket,
      messages: messages ?? [],
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const actor = await getSupportActor(supabase, user.id)
  if (!canAccessSupportInbox(actor)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 422 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.status) {
    updates.status = parsed.data.status
    if (parsed.data.status === 'cerrado') {
      updates.closed_at = new Date().toISOString()
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 422 })
  }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('support_tickets')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
