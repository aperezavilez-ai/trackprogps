import { Worker, type Job } from 'bullmq'
import { processAlertCheck } from '../jobs/process-alert-check.js'
import { QUEUE_NAMES, type RedisConnection, type AlertCheckJob, type Queues } from './queues.js'

export function createAlertWorker(
  connection: RedisConnection,
  queues: Queues
): Worker<AlertCheckJob> {
  return new Worker<AlertCheckJob>(
    QUEUE_NAMES.ALERT_CHECKS,
    async (job: Job<AlertCheckJob>) => {
      await processAlertCheck(job.data, queues)
    },
    {
      connection,
      concurrency: 40,
    }
  )
}
