import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canManageBilling } from '@/lib/auth/permissions'
import { resendFromAlerts } from '@/lib/email/resend-from'
import { firstOrNull } from '@/lib/supabase/normalize'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('email, company_id, role, company:companies(name, email, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !canManageBilling(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 503 })
  }

  const company = firstOrNull(profile.company as {
    name: string
    email: string
    settings: { notification_email?: string; notification_email_secondary?: string }
  } | { name: string; email: string; settings: { notification_email?: string; notification_email_secondary?: string } }[] | null)

  const recipients = uniqueValidEmails([
    company?.settings?.notification_email,
    company?.settings?.notification_email_secondary,
    company?.email,
    profile.email,
  ])
  if (!recipients.length) {
    return NextResponse.json({
      error: 'Configura un email de alertas válido (ASCII) en la pestaña Notificaciones',
    }, { status: 422 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromAlerts(),
      to: recipients,
      subject: `[TrackPro GPS] Prueba de alertas — ${company?.name ?? 'Tu flota'}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1E40AF">TrackPro GPS</h2>
          <p>Si recibes este correo, las <strong>alertas por email</strong> están configuradas correctamente.</p>
          <p style="color:#6B7280;font-size:13px">Empresa: ${company?.name ?? '—'}</p>
        </div>
      `,
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    return NextResponse.json({ error: body.slice(0, 300) }, { status: 502 })
  }

  return NextResponse.json({ success: true, sent_to: recipients.join(', ') })
}

function uniqueValidEmails(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const email = (raw ?? '').trim().toLowerCase()
    if (!email || seen.has(email)) continue
    if (!/^[\x00-\x7F]+$/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}
