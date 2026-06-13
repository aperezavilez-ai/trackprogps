// ============================================================
// Notification Worker
// Calls Supabase Edge Function to send notifications
// ============================================================

import { Worker, type Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import type IORedis from 'ioredis'
import { QUEUE_NAMES, type NotificationJob } from './queues.js'

export function createNotificationWorker(connection: IORedis): Worker<NotificationJob> {
  const supabase = createSupabaseServiceClient()

  return new Worker<NotificationJob>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJob>) => {
      const { alertId, companyId, vehicleId, channels } = job.data

      // Filter to channels that are actual notification channels (not just 'platform')
      const externalChannels = channels.filter(c => c !== 'platform')
      if (!externalChannels.length) return

      // Invoke the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-alert-notification', {
        body: {
          alert_id:   alertId,
          company_id: companyId,
          vehicle_id: vehicleId,
          channels:   externalChannels,
        },
      })

      if (error) {
        console.error('[Notification Worker] Edge function error:', error)
        throw error
      }

      console.log(`[Notification Worker] Alert ${alertId} sent via: ${externalChannels.join(', ')}`, data)
    },
    {
      connection,
      concurrency: 5, // Rate limit notifications
    }
  )
}

function createSupabaseServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']!
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
