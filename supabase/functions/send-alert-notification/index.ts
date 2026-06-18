// Supabase Edge Function: send-alert-notification
// Deployed via: supabase functions deploy send-alert-notification

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NotificationPayload {
  alert_id: string
  company_id: string
  vehicle_id: string
  channels: string[]
}

serve(async (req: Request) => {
  const { alert_id, company_id, vehicle_id, channels }: NotificationPayload = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch alert details
  const { data: alert } = await supabase
    .from('alerts')
    .select(`
      *,
      vehicle:vehicles(economic_num, plates, brand, model, driver:drivers(full_name, phone, email))
    `)
    .eq('id', alert_id)
    .single()

  if (!alert) {
    return new Response(JSON.stringify({ error: 'Alert not found' }), { status: 404 })
  }

  // Fetch company notification contacts
  const { data: company } = await supabase
    .from('companies')
    .select('name, email, settings')
    .eq('id', company_id)
    .single()

  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404 })
  }

  const vehicle = alert.vehicle as {
    economic_num: string
    plates: string
    brand: string
    model: string
    driver: { full_name: string; phone: string | null; email: string | null } | null
  } | null

  const channelResults: Record<string, boolean> = {}

  // -------------------------------------------------------
  // EMAIL via Resend
  // -------------------------------------------------------
  if (channels.includes('email')) {
    const settings = (company.settings ?? {}) as {
      notification_email?: string
      notification_email_secondary?: string
    }
    const toEmails = uniqueValidEmails([
      settings.notification_email,
      settings.notification_email_secondary,
      company.email,
    ])

    if (toEmails.length) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          from:    Deno.env.get('RESEND_FROM_EMAIL') ?? 'alertas@trackprogps.mx',
          to:      toEmails,
          subject: `🚨 ${alert.title} — ${vehicle?.economic_num ?? 'Vehículo'} (${vehicle?.plates ?? ''})`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#EF4444;color:#fff;padding:16px;border-radius:8px 8px 0 0">
                <h2 style="margin:0">⚠️ ${alert.title}</h2>
              </div>
              <div style="border:1px solid #E5E7EB;border-top:none;padding:20px;border-radius:0 0 8px 8px">
                <p><strong>Mensaje:</strong> ${alert.message}</p>
                <p><strong>Vehículo:</strong> ${vehicle?.economic_num} — ${vehicle?.plates} (${vehicle?.brand} ${vehicle?.model})</p>
                <p><strong>Conductor:</strong> ${vehicle?.driver?.full_name ?? 'Sin asignar'}</p>
                ${alert.speed ? `<p><strong>Velocidad:</strong> ${alert.speed} km/h</p>` : ''}
                ${alert.lat ? `<p><strong>Ubicación:</strong> <a href="https://maps.google.com/?q=${alert.lat},${alert.lng}">Ver en mapa</a></p>` : ''}
                <p><strong>Fecha:</strong> ${new Date(alert.created_at).toLocaleString('es-MX')}</p>
              </div>
            </div>
          `,
        }),
      })

      channelResults['email'] = emailRes.ok
    }
  }

  // -------------------------------------------------------
  // WHATSAPP via Meta Cloud API
  // -------------------------------------------------------
  if (channels.includes('whatsapp')) {
    const settings = company.settings as {
      whatsapp_phone?: string
      notification_phone?: string
    }
    const phone = settings?.whatsapp_phone ?? settings?.notification_phone

    if (phone) {
      const message = `🚨 *${alert.title}*\n\n` +
        `*Empresa:* ${company.name}\n` +
        `*Vehículo:* ${vehicle?.economic_num} (${vehicle?.plates})\n` +
        `*Mensaje:* ${alert.message}\n` +
        (alert.speed ? `*Velocidad:* ${alert.speed} km/h\n` : '') +
        (alert.lat ? `*Ubicación:* https://maps.google.com/?q=${alert.lat},${alert.lng}\n` : '') +
        `*Hora:* ${new Date(alert.created_at).toLocaleString('es-MX')}`

      const waRes = await fetch(
        `https://graph.facebook.com/v19.0/${Deno.env.get('WHATSAPP_PHONE_ID')}/messages`,
        {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to:      phone.replace(/\D/g, ''),
            type:    'text',
            text: { body: message },
          }),
        }
      )

      channelResults['whatsapp'] = waRes.ok
    }
  }

  // -------------------------------------------------------
  // PUSH — Expo Push API + FCM legacy
  // -------------------------------------------------------
  if (channels.includes('push')) {
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('company_id', company_id)
      .eq('is_active', true)

    if (tokens?.length) {
      const expoTokens = tokens.filter(t => t.platform === 'expo').map(t => t.token)
      const fcmTokens  = tokens.filter(t => t.platform !== 'expo').map(t => t.token)

      if (expoTokens.length) {
        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            expoTokens.map(token => ({
              to:    token,
              title: alert.title,
              body:  alert.message,
              data:  { alert_id, vehicle_id, type: alert.type },
              sound: 'default',
              priority: 'high',
            }))
          ),
        })
        channelResults['push'] = expoRes.ok
      }

      if (fcmTokens.length && Deno.env.get('FCM_SERVER_KEY')) {
        const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
          method:  'POST',
          headers: {
            'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            registration_ids: fcmTokens,
            notification: { title: alert.title, body: alert.message },
            data: { alert_id, vehicle_id, type: alert.type },
          }),
        })
        channelResults['push'] = channelResults['push'] || fcmRes.ok
      }
    }
  }

  // Mark channels as sent
  await supabase
    .from('alerts')
    .update({
      channels_sent: Object.keys(channelResults).filter(k => channelResults[k]),
    })
    .eq('id', alert_id)

  return new Response(JSON.stringify({ success: true, channels: channelResults }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

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
