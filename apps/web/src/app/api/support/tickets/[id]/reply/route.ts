import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { canAccessSupportInbox, getSupportActor } from '@/lib/auth/support-access'
import { sendTicketReplyToCustomer } from '@/lib/email/send-support'
import { z } from 'zod'

const ReplySchema = z.object({
  body: z.string().min(5, 'Escribe una respuesta').max(8000),
  close: z.boolean().optional(),
})

export async function POST(
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

  const parsed = ReplySchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.body?.[0] ?? 'Datos inválidos'
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  const service = createSupabaseServiceClient()

  const { data: ticket, error: ticketError } = await service
    .from('support_tickets')
    .select('id, email, subject, status')
    .eq('id', params.id)
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  const replyText = parsed.data.body.trim()

  const { error: msgError } = await service.from('support_messages').insert({
    ticket_id: params.id,
    body: replyText,
    is_staff: true,
    author_user_id: user.id,
  })

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  const newStatus = parsed.data.close ? 'cerrado' : 'respondido'
  await service
    .from('support_tickets')
    .update({
      status: newStatus,
      assigned_to: user.id,
      ...(parsed.data.close ? { closed_at: new Date().toISOString() } : {}),
    })
    .eq('id', params.id)

  const emailSent = await sendTicketReplyToCustomer({
    to: ticket.email,
    replyBody: replyText,
    ticketSubject: ticket.subject,
  })

  return NextResponse.json({
    success: true,
    message: emailSent
      ? 'Respuesta enviada por correo al cliente'
      : 'Respuesta guardada (correo no enviado — revisa Resend)',
    email_sent: emailSent,
  })
}
