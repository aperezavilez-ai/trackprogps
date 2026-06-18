// ============================================================
// GPS TCP Server - Main entry point
// ============================================================

import { config as loadEnv } from 'dotenv'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import { TeltonikaDecoder } from './codecs/teltonika.js'
import { createRedisConnection, createQueues } from './queue/queues.js'
import { createGpsWorker } from './queue/gps-worker.js'
import { createAlertWorker } from './queue/alert-worker.js'
import { createNotificationWorker } from './queue/notification-worker.js'
import {
  registerConnection, getConnState, setImei, removeConnection, getConnectionCount,
} from './connections.js'
import { startCommandPoller } from './command-poller.js'
import { processGpsPosition } from './jobs/process-gps-position.js'

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

const PORT = parseInt(process.env['GPS_SERVER_PORT'] ?? '5000', 10)
const HOST = process.env['GPS_SERVER_HOST'] ?? '0.0.0.0'

const redis = createRedisConnection()

const queues = createQueues(redis)
const gpsWorker    = createGpsWorker(redis, queues)
const alertWorker  = createAlertWorker(redis, queues)
const notifWorker  = createNotificationWorker(redis)

gpsWorker.on('failed', (job, err) => {
  console.error(`[GPS Worker] Job ${job?.id} failed:`, err.message)
})

alertWorker.on('failed', (job, err) => {
  console.error(`[Alert Worker] Job ${job?.id} failed:`, err.message)
})

notifWorker.on('failed', (job, err) => {
  console.error(`[Notif Worker] Job ${job?.id} failed:`, err.message)
})

startCommandPoller()

const server = net.createServer((socket) => {
  const connId = `${socket.remoteAddress}:${socket.remotePort}`
  console.log(`[GPS] New connection: ${connId}`)

  registerConnection(connId, socket, Buffer.alloc(0))
  const conn = getConnState(connId)!
  socket.setTimeout(30_000)

  socket.on('data', async (chunk: Buffer) => {
    conn.buffer = Buffer.concat([conn.buffer, chunk])

    try {
      if (!conn.imei) {
        const imei = TeltonikaDecoder.parseIMEI(conn.buffer)
        if (!imei) {
          if (conn.buffer.length > 50) {
            console.warn(`[GPS] Invalid IMEI from ${connId}, closing`)
            socket.destroy()
          }
          return
        }

        setImei(connId, imei)
        conn.buffer = Buffer.alloc(0)
        socket.write(Buffer.from([0x01]))
        console.log(`[GPS] Device identified: IMEI=${imei} from ${connId}`)

      } else {
        const packet = TeltonikaDecoder.parseDataPacket(conn.buffer)
        if (!packet) {
          if (conn.buffer.length > 65536) {
            console.error(`[GPS] Buffer overflow for ${connId}, closing`)
            socket.destroy()
          }
          return
        }

        conn.buffer = Buffer.alloc(0)

        const ack = Buffer.alloc(4)
        ack.writeUInt32BE(packet.recordCount, 0)
        socket.write(ack)

        const jobData = {
          imei: conn.imei,
          records: packet.records,
          receivedAt: new Date().toISOString(),
        }

        void queues.gpsQueue
          .add('position', jobData, { jobId: `${conn.imei}-${Date.now()}` })
          .then(() => {
            console.log(`[GPS] Queued ${packet.records.length} records from ${conn.imei}`)
          })
          .catch(async (err) => {
            console.warn(`[GPS] Queue unavailable for ${conn.imei}, inline processing:`, err instanceof Error ? err.message : err)
            try {
              await processGpsPosition(jobData, queues)
              console.log(`[GPS] Inline processed ${packet.records.length} records from ${conn.imei}`)
            } catch (inlineErr) {
              console.error(`[GPS] Inline processing failed for ${conn.imei}:`, inlineErr)
            }
          })
      }
    } catch (err) {
      console.error(`[GPS] Error processing data from ${connId}:`, err)
      socket.destroy()
    }
  })

  socket.on('timeout', () => {
    console.log(`[GPS] Connection timeout: ${connId} (IMEI: ${conn.imei ?? 'unknown'})`)
    socket.destroy()
  })

  socket.on('error', (err) => {
    console.error(`[GPS] Socket error ${connId}:`, err.message)
  })

  socket.on('close', () => {
    const imei = conn.imei
    removeConnection(connId)
    console.log(`[GPS] Connection closed: ${connId} (IMEI: ${imei ?? 'unknown'})`)

    if (imei) {
      setTimeout(async () => {
        const { getConnectionByImei } = await import('./connections.js')
        if (!getConnectionByImei(imei)) {
          const { createSupabaseServiceClient } = await import('./lib/supabase.js')
          const supabase = createSupabaseServiceClient()
          await supabase.from('gps_devices').update({ status: 'offline' }).eq('imei', imei)
        }
      }, 60_000)
    }
  })
})

server.on('error', (err) => {
  console.error('[GPS] Server error:', err)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`[GPS] Server listening on ${HOST}:${PORT}`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[GPS] Received ${signal}, shutting down gracefully...`)
  server.close()
  await gpsWorker.close()
  await alertWorker.close()
  await notifWorker.close()
  await queues.gpsQueue.close()
  await queues.alertQueue.close()
  await queues.notificationQueue.close()
  console.log('[GPS] Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

import http from 'node:http'
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      connections: getConnectionCount(),
      uptime: process.uptime(),
    }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

healthServer.listen(parseInt(process.env['HEALTH_PORT'] ?? '3001', 10))
console.log('[GPS] Health check available at :3001/health')
