import { resendFromNoreply } from '@/lib/email/resend-from'

const ROLE_LABELS: Record<string, string> = {
  admin_empresa: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  cliente_consulta: 'Solo consulta',
  miembro_familiar: 'Miembro familiar',
  super_admin: 'Super Admin',
}

export async function sendInvitationEmail(opts: {
  to: string
  companyName: string
  invitedBy: string
  role: string
  inviteUrl: string
}): Promise<boolean> {
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
      to: [opts.to],
      subject: `Invitación a TrackPro GPS — ${opts.companyName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1E40AF;padding:20px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:20px">📍 TrackPro GPS</h1>
          </div>
          <div style="border:1px solid #E5E7EB;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p>Hola,</p>
            <p><strong>${opts.invitedBy}</strong> te invitó a <strong>${opts.companyName}</strong> como <strong>${ROLE_LABELS[opts.role] ?? opts.role}</strong>.</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${opts.inviteUrl}"
                style="background:#2563EB;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">
                Aceptar invitación
              </a>
            </div>
            <p style="color:#6B7280;font-size:12px">Si no esperabas esta invitación, ignora este correo.</p>
          </div>
        </div>
      `,
    }),
  })

  return res.ok
}
