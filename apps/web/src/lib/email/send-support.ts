import { resendFromNoreply } from '@/lib/email/resend-from'
import { LEGAL } from '@/lib/legal/site-legal'

function emailShell(title: string, body: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0f172a;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">TrackPro GPS</h1>
        <p style="color:#fb923c;margin:8px 0 0;font-size:13px">${title}</p>
      </div>
      <div style="border:1px solid #E5E7EB;border-top:none;padding:24px;border-radius:0 0 12px 12px;background:#fff">
        ${body}
      </div>
    </div>
  `
}

async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromNoreply(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  return res.ok
}

const SOURCE_LABELS: Record<string, string> = {
  login: 'Login',
  register: 'Registro',
  descargar: 'Descargar app',
  other: 'Web',
}

export async function sendNewTicketAdminEmail(opts: {
  ticketId: string
  email: string
  phone: string
  message: string
  source: string
  adminUrl: string
}): Promise<boolean> {
  const adminTo = process.env.SUPPORT_INBOX_EMAIL ?? LEGAL.supportEmail
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Nueva consulta de soporte (#${opts.ticketId.slice(0, 8)})</p>
    <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:#6B7280;width:100px">Correo</td><td><strong>${opts.email}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#6B7280">Teléfono</td><td>${opts.phone}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280">Origen</td><td>${SOURCE_LABELS[opts.source] ?? opts.source}</td></tr>
    </table>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;font-size:14px;color:#374151;white-space:pre-wrap">${opts.message.replace(/</g, '&lt;')}</div>
    <p style="margin-top:20px;text-align:center">
      <a href="${opts.adminUrl}" style="background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Ver en panel de soporte</a>
    </p>
  `

  return sendEmail(adminTo, `[Soporte] Nueva consulta — ${opts.email}`, emailShell('Bandeja de soporte', body))
}

export async function sendTicketReplyToCustomer(opts: {
  to: string
  customerName?: string
  replyBody: string
  ticketSubject: string
}): Promise<boolean> {
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hola${opts.customerName ? ` ${opts.customerName}` : ''},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">Respondimos tu consulta sobre <strong>${opts.ticketSubject.replace(/</g, '&lt;')}</strong>:</p>
    <div style="background:#FFF7ED;border-left:4px solid #f97316;padding:16px;margin:16px 0;font-size:14px;color:#374151;white-space:pre-wrap">${opts.replyBody.replace(/</g, '&lt;')}</div>
    <p style="color:#6B7280;font-size:13px;line-height:1.5">
      Si necesitas más ayuda, responde a este correo o contáctanos desde ${LEGAL.domain}.
    </p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:20px">${LEGAL.brand} · ${LEGAL.supportEmail}</p>
  `

  return sendEmail(opts.to, `Re: ${opts.ticketSubject} — TrackPro GPS`, emailShell('Respuesta de soporte', body))
}

export async function sendTicketReceivedConfirmation(opts: {
  to: string
  ticketSubject: string
}): Promise<boolean> {
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Recibimos tu consulta:</p>
    <p style="color:#374151;font-size:15px;font-weight:600">${opts.ticketSubject.replace(/</g, '&lt;')}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Nuestro equipo te responderá por correo lo antes posible.
    </p>
  `

  return sendEmail(opts.to, 'Recibimos tu consulta — TrackPro GPS', emailShell('Consulta recibida', body))
}
