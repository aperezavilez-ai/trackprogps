// ============================================================
// GPS Queue - BullMQ queue definitions and types
// ============================================================

import { Queue } from 'bullmq'
import type { TeltonikaRecord } from '@gps-saas/types'

// ------------------------------------------------------------
// Redis connection (BullMQ-compatible options object)
// ------------------------------------------------------------
export interface RedisConnection {
  url: string
  maxRetriesPerRequest: null
  enableReadyCheck: false
}

export function createRedisConnection(): RedisConnection {
  const url = process.env['REDIS_URL']
  if (!url) throw new Error('REDIS_URL environment variable is required')

  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }
}

// ------------------------------------------------------------
// Queue Job Types
// ------------------------------------------------------------

export interface GpsPositionJob {
  imei: string
  records: TeltonikaRecord[]
  receivedAt: string
}

export interface AlertCheckJob {
  vehicleId: string
  companyId: string
  position: {
    lat: number
    lng: number
    speed: number
    ignition: boolean
    odometer: number
  }
  previousIgnition?: boolean
}

export interface NotificationJob {
  alertId: string
  companyId: string
  vehicleId: string
  channels: string[]
}

// ------------------------------------------------------------
// Queue names
// ------------------------------------------------------------
export const QUEUE_NAMES = {
  GPS_POSITIONS: 'gps-positions',
  ALERT_CHECKS:  'alert-checks',
  NOTIFICATIONS: 'notifications',
} as const

// ------------------------------------------------------------
// Queue factory
// ------------------------------------------------------------
export function createQueues(connection: RedisConnection) {
  const gpsQueue = new Queue<GpsPositionJob>(QUEUE_NAMES.GPS_POSITIONS, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 2000 },
    },
  })

  const alertQueue = new Queue<AlertCheckJob>(QUEUE_NAMES.ALERT_CHECKS, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 500 },
      removeOnComplete: { count: 10000 },
      removeOnFail: { count: 3000 },
    },
  })

  const notificationQueue = new Queue<NotificationJob>(QUEUE_NAMES.NOTIFICATIONS, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 10000 },
      removeOnFail: { count: 2000 },
    },
  })

  return { gpsQueue, alertQueue, notificationQueue }
}

export type Queues = ReturnType<typeof createQueues>
