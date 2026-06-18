// Supabase Edge Function: send-payment-failed-email
// Deploy: supabase functions deploy send-payment-failed-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  const { company_id } = await req.json() as { company_id: string }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: company } = await supabase
    .from('companies')
    .select('name, email, plan:plans(name)')
    .eq('id', company_id)
    .single()

  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404 })
  }

  const plan = company.plan as { name: string } | null

  // Send via Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    Deno.env.get('RESEND_FROM_BILLING') ?? 'facturacion@trackprogps.mx',
      to:      [company.email],
      subject: '⚠️ Problema con tu pago — TrackPro GPS',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#EF4444;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center">
            <h2 style="margin:0">⚠️ Pago fallido</h2>
          </div>
          <div style="border:1px solid #E5E7EB;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p>Hola <strong>${company.name}</strong>,</p>
            <p>No pudimos procesar el pago de tu suscripción al plan <strong>${plan?.name ?? 'TrackPro'}</strong>.</p>
            <p>Para evitar la suspensión de tu servicio, actualiza tu método de pago antes de 7 días:</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${Deno.env.get('APP_URL')}/billing"
                style="background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Actualizar método de pago
              </a>
            </div>
            <p style="color:#6B7280;font-size:13px">
              Si tienes alguna pregunta, escríbenos a alertas@trackprogps.mx
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
