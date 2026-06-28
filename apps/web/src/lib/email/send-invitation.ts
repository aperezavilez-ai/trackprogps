import { resendFromNoreply } from '@/lib/email/resend-from'

const ROLE_LABELS: Record<string, string> = {
  admin_empresa: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  cliente_consulta: 'Solo consulta',
  miembro_familiar: 'Miembro familiar',
  super_admin: 'Super Admin',
}

function emailShell(title: string, body: string, ctaLabel: string, ctaUrl: string, footnote: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">TrackPro GPS</h1>
        <p style="color:#fb923c;margin:8px 0 0;font-size:13px">${title}</p>
      </div>
      <div style="border:1px solid #E5E7EB;border-top:none;padding:28px;border-radius:0 0 12px 12px;background:#fff">
        ${body}
        <div style="text-align:center;margin:28px 0">
          <a href="${ctaUrl}"
            style="background:#f97316;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">
            ${ctaLabel}
          </a>
        </div>
        <p style="color:#6B7280;font-size:12px;line-height:1.5">${footnote}</p>
        <p style="color:#9CA3AF;font-size:11px;margin-top:16px;word-break:break-all">
          Si el botón no funciona, copia este enlace:<br/>
          <a href="${ctaUrl}" style="color:#ea580c">${ctaUrl}</a>
        </p>
      </div>
    </div>
  `
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
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
      to: [to],
      subject,
      html,
    }),
  })

  return res.ok
}

export async function sendInvitationEmail(opts: {
  to: string
  companyName: string
  invitedBy: string
  role: string
  inviteUrl: string
}): Promise<boolean> {
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hola,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      <strong>${opts.invitedBy}</strong> te dio acceso a <strong>${opts.companyName}</strong>
      como <strong>${roleLabel}</strong> en TrackPro GPS.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Pulsa el botón para <strong>activar tu cuenta y crear tu contraseña</strong>.
      No enviamos contraseñas por correo por seguridad.
    </p>
  `

  return sendEmail(
    opts.to,
    `Activa tu cuenta — TrackPro GPS (${opts.companyName})`,
    emailShell(
      'Activación de cuenta',
      body,
      'Activar cuenta y crear contraseña',
      opts.inviteUrl,
      'Si no esperabas este correo, ignóralo. El enlace caduca en 24 horas. Para recuperar acceso después, usa «Olvidé mi contraseña» en el inicio de sesión.',
    ),
  )
}

export async function sendPasswordResetEmail(opts: {
  to: string
  resetUrl: string
  context?: 'admin' | 'self'
}): Promise<boolean> {
  const intro = opts.context === 'admin'
    ? 'Un administrador solicitó restablecer tu contraseña de TrackPro GPS.'
    : 'Recibimos una solicitud para restablecer tu contraseña de TrackPro GPS.'

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hola,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">${intro}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Usa el botón para elegir una <strong>nueva contraseña</strong>. Si no fuiste tú, ignora este correo.
    </p>
  `

  return sendEmail(
    opts.to,
    'Restablecer contraseña — TrackPro GPS',
    emailShell(
      'Restablecer contraseña',
      body,
      'Elegir nueva contraseña',
      opts.resetUrl,
      'Por seguridad no incluimos tu contraseña actual ni una temporal. El enlace caduca en 24 horas.',
    ),
  )
}

export async function sendActivationReminderEmail(opts: {
  to: string
  companyName: string
  activateUrl: string
}): Promise<boolean> {
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hola,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Tu acceso a <strong>${opts.companyName}</strong> en TrackPro GPS aún no está activado.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Completa la activación creando tu contraseña con el botón de abajo.
    </p>
  `

  return sendEmail(
    opts.to,
    `Reenvío: activa tu cuenta — TrackPro GPS`,
    emailShell(
      'Reenvío de activación',
      body,
      'Activar cuenta ahora',
      opts.activateUrl,
      'Si ya activaste tu cuenta, inicia sesión normalmente o usa «Olvidé mi contraseña».',
    ),
  )
}
