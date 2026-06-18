import { Worker, type Job } from 'bullmq'
import { processGpsPosition } from '../jobs/process-gps-position.js'
import { QUEUE_NAMES, type RedisConnection, type GpsPositionJob, type Queues } from './queues.js'

export function createGpsWorker(
  connection: RedisConnection,
  queues: Queues
): Worker<GpsPositionJob> {
  return new Worker<GpsPositionJob>(
    QUEUE_NAMES.GPS_POSITIONS,
    async (job: Job<GpsPositionJob>) => {
      await processGpsPosition(job.data, queues)
    },
    {
      connection,
      concurrency: 30,
    }
  )
}
