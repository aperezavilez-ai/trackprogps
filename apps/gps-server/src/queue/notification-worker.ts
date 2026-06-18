// ============================================================
// Notification Worker
// Direct Resend/push sender on Fly.io
// ============================================================

import { Worker, type Job } from 'bullmq'
import { createSupabaseServiceClient } from '../lib/supabase.js'
import { sendAlertNotifications } from '../notifications/send-alert.js'
import type { RedisConnection } from './queues.js'
import { QUEUE_NAMES, type NotificationJob } from './queues.js'

export function createNotificationWorker(connection: RedisConnection): Worker<NotificationJob> {
  const supabase = createSupabaseServiceClient()

  return new Worker<NotificationJob>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJob>) => {
      const { alertId, companyId, vehicleId, channels } = job.data

      const externalChannels = channels.filter((c: string) => c !== 'platform')
      if (!externalChannels.length) return

      const channelResults = await sendAlertNotifications(supabase, {
        alertId,
        companyId,
        vehicleId,
        channels: externalChannels,
      })

      const sent = Object.entries(channelResults).filter(([, v]) => v).map(([k]) => k)
      if (!sent.length) {
        throw new Error(`No channels delivered for alert ${alertId}`)
      }

      console.log(
        `[Notification Worker] Alert ${alertId} via direct sender: ${sent.join(', ')}`,
        channelResults,
      )
    },
    {
      connection,
      concurrency: 10,
    },
  )
}
