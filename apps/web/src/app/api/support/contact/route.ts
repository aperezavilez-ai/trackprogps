import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { ticketSubjectFromBody } from '@/lib/auth/support-access'
import {
  sendNewTicketAdminEmail,
  sendTicketReceivedConfirmation,
} from '@/lib/email/send-support'
import { z } from 'zod'

const ContactSchema = z.object({
  email: z.string().email('Correo inválido'),
  phone: z.string().min(11, 'Teléfono inválido').max(20).regex(/^\+[1-9]\d{9,14}$/, 'Incluye código de país válido'),
  message: z.string().min(20, 'Describe tu consulta (mín. 20 caracteres)').max(4000),
  source: z.enum(['login', 'register', 'descargar', 'other']).default('other'),
  website: z.string().max(0).optional(),
  acceptedPrivacy: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la privacidad' }) }),
})

function getClientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  }

  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos'
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  if (parsed.data.website) {
    return NextResponse.json({ success: true, message: 'Consulta enviada' })
  }

  const { email, phone, message, source } = parsed.data
  const normalizedPhone = phone.replace(/\s/g, '')
  if (!/^\+[1-9]\d{9,14}$/.test(normalizedPhone)) {
    return NextResponse.json({ error: 'Teléfono inválido — verifica el código de país y el número' }, { status: 422 })
  }

  const service = createSupabaseServiceClient()

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: recent } = await service
    .from('support_tickets')
    .select('id')
    .eq('email', email.toLowerCase())
    .gte('created_at', fiveMinAgo)
    .limit(1)

  if (recent?.length) {
    return NextResponse.json({
      error: 'Ya enviaste una consulta recientemente. Espera unos minutos o escríbenos a soporte@trackprogps.mx',
    }, { status: 429 })
  }

  const subject = ticketSubjectFromBody(message)

  const { data: ticket, error: ticketError } = await service
    .from('support_tickets')
    .insert({
      email: email.toLowerCase().trim(),
      phone: normalizedPhone,
      subject,
      source,
      status: 'nuevo',
      client_ip: getClientIp(request),
    })
    .select('id')
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: ticketError?.message ?? 'Error al guardar' }, { status: 500 })
  }

  const { error: msgError } = await service.from('support_messages').insert({
    ticket_id: ticket.id,
    body: message.trim(),
    is_staff: false,
  })

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trackprogps.mx'
  const adminUrl = `${appUrl}/admin/support?ticket=${ticket.id}`

  const [adminSent, confirmSent] = await Promise.all([
    sendNewTicketAdminEmail({
      ticketId: ticket.id,
      email: email.toLowerCase(),
      phone: normalizedPhone,
      message: message.trim(),
      source,
      adminUrl,
    }),
    sendTicketReceivedConfirmation({ to: email.toLowerCase(), ticketSubject: subject }),
  ])

  return NextResponse.json({
    success: true,
    message: 'Consulta enviada. Te responderemos por correo.',
    email_sent: adminSent || confirmSent,
  }, { status: 201 })
}
