import type { SupabaseClient } from '@supabase/supabase-js'

interface SendAlertPayload {
  alertId: string
  companyId: string
  vehicleId: string
  channels: string[]
}

type VehicleInfo = {
  economic_num: string
  plates: string
  brand: string
  model: string
  driver: { full_name: string; phone: string | null; email: string | null } | null
}

export async function sendAlertNotifications(
  supabase: SupabaseClient,
  payload: SendAlertPayload,
): Promise<Record<string, boolean>> {
  const { alertId, companyId, channels } = payload
  const channelResults: Record<string, boolean> = {}

  const { data: alert } = await supabase
    .from('alerts')
    .select(`
      *,
      vehicle:vehicles(economic_num, plates, brand, model, driver:drivers(full_name, phone, email))
    `)
    .eq('id', alertId)
    .single()

  if (!alert) throw new Error(`Alert ${alertId} not found`)

  const { data: company } = await supabase
    .from('companies')
    .select('name, email, settings')
    .eq('id', companyId)
    .single()

  if (!company) throw new Error(`Company ${companyId} not found`)

  const vehicle = alert.vehicle as VehicleInfo | null
  const settings = (company.settings ?? {}) as {
    notification_email?: string
    notification_email_secondary?: string
    whatsapp_phone?: string
    notification_phone?: string
  }

  if (channels.includes('email')) {
    const resendKey = process.env['RESEND_API_KEY']
    const toEmails = uniqueValidEmails([
      settings.notification_email,
      settings.notification_email_secondary,
      company.email,
    ])
    const fromEmail = process.env['RESEND_FROM_EMAIL'] ?? 'alertas@trackprogps.mx'

    if (resendKey && toEmails.length) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: toEmails,
          subject: `🚨 ${alert.title} — ${vehicle?.economic_num ?? 'Vehículo'} (${vehicle?.plates ?? ''})`,
          html: buildAlertEmailHtml(alert, vehicle, company.name),
        }),
      })
      channelResults['email'] = emailRes.ok
      if (!emailRes.ok) {
        const err = await emailRes.text().catch(() => '')
        console.error('[Notifications] Resend error:', err.slice(0, 200))
      }
    }
  }

  if (channels.includes('whatsapp')) {
    const waToken = process.env['WHATSAPP_TOKEN']
    const waPhoneId = process.env['WHATSAPP_PHONE_ID']
    const phone = settings.whatsapp_phone ?? settings.notification_phone

    if (waToken && waPhoneId && phone && waToken.length > 20) {
      const message =
        `🚨 *${alert.title}*\n\n` +
        `*Empresa:* ${company.name}\n` +
        `*Vehículo:* ${vehicle?.economic_num} (${vehicle?.plates})\n` +
        `*Mensaje:* ${alert.message}\n` +
        (alert.speed ? `*Velocidad:* ${alert.speed} km/h\n` : '') +
        (alert.lat ? `*Ubicación:* https://maps.google.com/?q=${alert.lat},${alert.lng}\n` : '') +
        `*Hora:* ${new Date(alert.created_at).toLocaleString('es-MX')}`

      const waRes = await fetch(
        `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone.replace(/\D/g, ''),
            type: 'text',
            text: { body: message },
          }),
        },
      )
      channelResults['whatsapp'] = waRes.ok
    }
  }

  if (channels.includes('push')) {
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (tokens?.length) {
      const expoTokens = tokens.filter(t => t.platform === 'expo').map(t => t.token)
      const webTokens = tokens.filter(t => t.platform === 'web').map(t => t.token)
      const fcmTokens = tokens.filter(t => t.platform === 'fcm').map(t => t.token)

      if (expoTokens.length) {
        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            expoTokens.map(token => ({
              to: token,
              title: alert.title,
              body: alert.message,
              data: { alert_id: alertId, vehicle_id: payload.vehicleId, type: alert.type },
              sound: 'default',
              priority: 'high',
            })),
          ),
        })
        channelResults['push'] = expoRes.ok
      }

      if (webTokens.length) {
        const webOk = await sendWebPush(webTokens, alert.title, alert.message, {
          alert_id: alertId,
          vehicle_id: payload.vehicleId,
          type: alert.type,
        })
        channelResults['push'] = channelResults['push'] || webOk
      }

      const fcmKey = process.env['FCM_SERVER_KEY']
      if (fcmTokens.length && fcmKey && !fcmKey.startsWith('AAAA...')) {
        const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            Authorization: `key=${fcmKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registration_ids: fcmTokens,
            notification: { title: alert.title, body: alert.message },
            data: { alert_id: alertId, vehicle_id: payload.vehicleId, type: alert.type },
          }),
        })
        channelResults['push'] = channelResults['push'] || fcmRes.ok
      }
    }
  }

  const sent = Object.keys(channelResults).filter(k => channelResults[k])
  if (sent.length) {
    await supabase.from('alerts').update({ channels_sent: sent }).eq('id', alertId)
  }

  return channelResults
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

async function sendWebPush(
  subscriptions: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  const publicKey = process.env['VAPID_PUBLIC_KEY']
  const privateKey = process.env['VAPID_PRIVATE_KEY']
  const subject = process.env['VAPID_SUBJECT'] ?? 'mailto:alertas@trackprogps.mx'

  if (!publicKey || !privateKey) return false

  try {
    const webpush = await import('web-push')
    webpush.setVapidDetails(subject, publicKey, privateKey)

    const results = await Promise.all(
      subscriptions.map(async (raw) => {
        try {
          const sub = JSON.parse(raw) as import('web-push').PushSubscription
          await webpush.sendNotification(
            sub,
            JSON.stringify({ title, body, data, url: '/alerts' }),
          )
          return true
        } catch {
          return false
        }
      }),
    )
    return results.some(Boolean)
  } catch (err) {
    console.error('[Notifications] Web push error:', err instanceof Error ? err.message : err)
    return false
  }
}

function buildAlertEmailHtml(
  alert: { title: string; message: string; speed?: number | null; lat?: number | null; lng?: number | null; created_at: string },
  vehicle: VehicleInfo | null,
  companyName: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1E40AF;color:#fff;padding:16px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">📍 TrackPro GPS</h2>
        <p style="margin:4px 0 0;opacity:0.9">${companyName}</p>
      </div>
      <div style="background:#EF4444;color:#fff;padding:12px 16px">
        <h3 style="margin:0">⚠️ ${alert.title}</h3>
      </div>
      <div style="border:1px solid #E5E7EB;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <p><strong>Mensaje:</strong> ${alert.message}</p>
        <p><strong>Vehículo:</strong> ${vehicle?.economic_num ?? '—'} — ${vehicle?.plates ?? ''} (${vehicle?.brand ?? ''} ${vehicle?.model ?? ''})</p>
        <p><strong>Conductor:</strong> ${vehicle?.driver?.full_name ?? 'Sin asignar'}</p>
        ${alert.speed ? `<p><strong>Velocidad:</strong> ${alert.speed} km/h</p>` : ''}
        ${alert.lat ? `<p><strong>Ubicación:</strong> <a href="https://maps.google.com/?q=${alert.lat},${alert.lng}">Ver en mapa</a></p>` : ''}
        <p><strong>Fecha:</strong> ${new Date(alert.created_at).toLocaleString('es-MX')}</p>
        <p style="margin-top:16px"><a href="https://trackprogps.mx/alerts" style="color:#1E40AF">Ver alertas en TrackPro GPS →</a></p>
      </div>
    </div>
  `
}
