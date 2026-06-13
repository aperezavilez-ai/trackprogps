// Supabase Edge Function: send-invitation-email
// Deploy: supabase functions deploy send-invitation-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req: Request) => {
  const { email, company_name, invited_by, role, invite_url } = await req.json() as {
    email:        string
    company_name: string
    invited_by:   string
    role:         string
    invite_url:   string
  }

  const ROLE_LABELS: Record<string, string> = {
    admin_empresa:    'Administrador',
    supervisor:       'Supervisor',
    operador:         'Operador',
    cliente_consulta: 'Solo consulta',
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'noreply@trackpro.mx',
      to:      [email],
      subject: `Te han invitado a TrackPro GPS — ${company_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1E3A5F;padding:20px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:20px">📍 TrackPro GPS</h1>
          </div>
          <div style="border:1px solid #E5E7EB;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p>Hola,</p>
            <p><strong>${invited_by}</strong> te ha invitado a unirte a <strong>${company_name}</strong> en TrackPro GPS como <strong>${ROLE_LABELS[role] ?? role}</strong>.</p>
            <p>Haz clic en el botón para aceptar la invitación y crear tu cuenta:</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${invite_url}"
                style="background:#2563EB;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
                Aceptar invitación
              </a>
            </div>
            <p style="color:#6B7280;font-size:12px">
              Este enlace expira en 24 horas. Si no solicitaste esta invitación, puedes ignorar este correo.
            </p>
          </div>
        </div>
      `,
    }),
  })

  return new Response(JSON.stringify({ success: res.ok }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
