// ============================================================
// GPS TCP Server - Main entry point
// Receives Teltonika FMC920 connections on TCP port
// ============================================================

import net from 'node:net'
import { TeltonikaDecoder } from './codecs/teltonika.js'
import { createRedisConnection, createQueues } from './queue/queues.js'
import { createGpsWorker } from './queue/gps-worker.js'
import { createAlertWorker } from './queue/alert-worker.js'
import { createNotificationWorker } from './queue/notification-worker.js'

const PORT = parseInt(process.env['GPS_SERVER_PORT'] ?? '5000', 10)
const HOST = process.env['GPS_SERVER_HOST'] ?? '0.0.0.0'

// Track active connections
const connections = new Map<string, {
  socket: net.Socket
  imei: string | null
  buffer: Buffer
  connectedAt: Date
}>()

// ------------------------------------------------------------
// Initialize queues and workers
// ------------------------------------------------------------
const redis = createRedisConnection()
await redis.connect()

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

// ------------------------------------------------------------
// TCP Server
// ------------------------------------------------------------
const server = net.createServer((socket) => {
  const connId = `${socket.remoteAddress}:${socket.remotePort}`
  console.log(`[GPS] New connection: ${connId}`)

  const conn = {
    socket,
    imei: null as string | null,
    buffer: Buffer.alloc(0),
    connectedAt: new Date(),
  }

  connections.set(connId, conn)

  // 30 second timeout for idle connections
  socket.setTimeout(30_000)

  socket.on('data', async (chunk: Buffer) => {
    // Accumulate data in buffer
    conn.buffer = Buffer.concat([conn.buffer, chunk])

    try {
      if (!conn.imei) {
        // First packet: IMEI identification
        const imei = TeltonikaDecoder.parseIMEI(conn.buffer)
        if (!imei) {
          // Not enough data yet
          if (conn.buffer.length > 50) {
            console.warn(`[GPS] Invalid IMEI from ${connId}, closing`)
            socket.destroy()
          }
          return
        }

        conn.imei = imei
        conn.buffer = Buffer.alloc(0) // clear buffer after IMEI

        // Send ACK: 0x01 = accepted
        socket.write(Buffer.from([0x01]))
        console.log(`[GPS] Device identified: IMEI=${imei} from ${connId}`)

      } else {
        // Subsequent packets: GPS data
        const packet = TeltonikaDecoder.parseDataPacket(conn.buffer)
        if (!packet) {
          // Need more data
          if (conn.buffer.length > 65536) {
            // Buffer too large, something is wrong
            console.error(`[GPS] Buffer overflow for ${connId}, closing`)
            socket.destroy()
          }
          return
        }

        // Clear buffer after successful parse
        conn.buffer = Buffer.alloc(0)

        // Send ACK with record count
        const ack = Buffer.alloc(4)
        ack.writeUInt32BE(packet.recordCount, 0)
        socket.write(ack)

        // Enqueue for async processing
        await queues.gpsQueue.add(
          'position',
          {
            imei: conn.imei,
            records: packet.records,
            receivedAt: new Date().toISOString(),
          },
          {
            // Use IMEI as job ID prefix to allow deduplication within same second
            jobId: `${conn.imei}-${Date.now()}`,
          }
        )

        console.log(
          `[GPS] Queued ${packet.records.length} records from ${conn.imei}`
        )
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
    connections.delete(connId)
    console.log(`[GPS] Connection closed: ${connId} (IMEI: ${conn.imei ?? 'unknown'})`)

    // Mark device offline if no reconnection in 60s
    if (conn.imei) {
      setTimeout(async () => {
        const stillConnected = [...connections.values()]
          .some(c => c.imei === conn.imei)

        if (!stillConnected) {
          const { createClient } = await import('@supabase/supabase-js')
          const supabase = createClient(
            process.env['NEXT_PUBLIC_SUPABASE_URL']!,
            process.env['SUPABASE_SERVICE_ROLE_KEY']!,
            { auth: { persistSession: false, autoRefreshToken: false } }
          )
          await supabase
            .from('gps_devices')
            .update({ status: 'offline' })
            .eq('imei', conn.imei!)
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
  console.log(`[GPS] Active connections: ${connections.size}`)
})

// ------------------------------------------------------------
// Graceful shutdown
// ------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[GPS] Received ${signal}, shutting down gracefully...`)

  server.close()

  // Close all connections
  for (const [id, conn] of connections) {
    console.log(`[GPS] Closing connection: ${id}`)
    conn.socket.destroy()
  }

  // Shutdown workers and queues
  await gpsWorker.close()
  await alertWorker.close()
  await notifWorker.close()
  await queues.gpsQueue.close()
  await queues.alertQueue.close()
  await queues.notificationQueue.close()
  await redis.quit()

  console.log('[GPS] Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

// Health check HTTP server (for Railway/Fly.io)
import http from 'node:http'
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      connections: connections.size,
      uptime: process.uptime(),
    }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

healthServer.listen(parseInt(process.env['HEALTH_PORT'] ?? '3001', 10))
console.log('[GPS] Health check available at :3001/health')
