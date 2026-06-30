import { createHmac, randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type WebhookEventType =
  | 'alert.created'
  | 'geofence.enter'
  | 'geofence.exit'
  | 'vehicle.position_updated'
  | 'mobile.sos'

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `sha256=${digest}`
}

export function alertTypeToWebhookEvent(alertType: string): WebhookEventType {
  if (alertType === 'geofence_enter') return 'geofence.enter'
  if (alertType === 'geofence_exit') return 'geofence.exit'
  return 'alert.created'
}

export async function dispatchWebhooks(
  supabase: SupabaseClient,
  companyId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events, failure_count')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const matching = (endpoints ?? []).filter(ep =>
    (ep.events as string[]).includes(eventType) || (ep.events as string[]).includes('*'),
  )

  if (matching.length === 0) return

  const payload = {
    id: randomUUID(),
    type: eventType,
    created_at: new Date().toISOString(),
    company_id: companyId,
    data,
  }
  const body = JSON.stringify(payload)
  const timestamp = String(Math.floor(Date.now() / 1000))

  await Promise.allSettled(
    matching.map(async (ep) => {
      const signature = signWebhookPayload(ep.secret, timestamp, body)
      try {
        const res = await fetch(ep.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TrackProGPS-Webhook/1.0',
            'X-TrackPro-Signature': signature,
            'X-TrackPro-Timestamp': timestamp,
            'X-TrackPro-Event': eventType,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        })

        if (res.ok) {
          await supabase
            .from('webhook_endpoints')
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq('id', ep.id)
        } else {
          await supabase
            .from('webhook_endpoints')
            .update({
              failure_count: ((ep as { failure_count?: number }).failure_count ?? 0) + 1,
              last_failure_at: new Date().toISOString(),
            })
            .eq('id', ep.id)
        }
      } catch {
        await supabase
          .from('webhook_endpoints')
          .update({ last_failure_at: new Date().toISOString() })
          .eq('id', ep.id)
      }
    }),
  )
}
