// ============================================================
// GPS Position Worker
// Processes queued GPS records and saves to Supabase
// ============================================================

import { Worker, type Job } from 'bullmq'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type IORedis from 'ioredis'
import {
  QUEUE_NAMES,
  type GpsPositionJob,
  type AlertCheckJob,
  type Queues,
} from './queues.js'

// Cache: IMEI → { vehicleId, companyId, maxSpeed, prevIgnition }
const deviceCache = new Map<string, {
  vehicleId: string
  companyId: string
  deviceId: string
  maxSpeed: number
  prevIgnition: boolean
  cachedAt: number
}>()

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function createGpsWorker(
  connection: IORedis,
  queues: Queues
): Worker<GpsPositionJob> {
  const supabase = createSupabaseServiceClient()

  return new Worker<GpsPositionJob>(
    QUEUE_NAMES.GPS_POSITIONS,
    async (job: Job<GpsPositionJob>) => {
      const { imei, records, receivedAt } = job.data

      // 1. Lookup device by IMEI (with cache)
      const device = await lookupDevice(supabase, imei)
      if (!device) {
        console.warn(`[GPS Worker] Unknown IMEI: ${imei} — skipping`)
        return
      }

      // 2. Process each record
      for (const record of records) {
        // 2a. Build position object
        const io = record.io_elements
        const position = {
          vehicle_id:  device.vehicleId,
          company_id:  device.companyId,
          device_id:   device.deviceId,
          lat:         record.lat,
          lng:         record.lng,
          speed:       record.speed,
          heading:     record.heading,
          altitude:    record.altitude,
          ignition:    io.ignition ?? false,
          odometer:    io.total_odometer ?? io.odometer ?? 0,
          gsm_signal:  io.gsm_signal ?? 0,
          battery_lvl: io.battery_voltage ?? 0,
          satellites:  record.satellites,
          raw_io:      io,
          recorded_at: record.timestamp.toISOString(),
          server_at:   receivedAt,
        }

        // 2b. Upsert current position (1 row per vehicle)
        const { error: upsertError } = await supabase
          .from('vehicle_positions')
          .upsert(
            { ...position, id: undefined },
            {
              onConflict: 'vehicle_id',
              ignoreDuplicates: false,
            }
          )

        if (upsertError) {
          console.error('[GPS Worker] Upsert error:', upsertError.message)
          throw upsertError
        }

        // 2c. Insert into history
        const { error: histError } = await supabase
          .from('position_history')
          .insert(position)

        if (histError) {
          console.error('[GPS Worker] History insert error:', histError.message)
          // Don't throw — history failure shouldn't block current position
        }

        // 2d. Queue alert check
        const alertJob: AlertCheckJob = {
          vehicleId: device.vehicleId,
          companyId: device.companyId,
          position: {
            lat:      record.lat,
            lng:      record.lng,
            speed:    record.speed,
            ignition: io.ignition ?? false,
            odometer: io.total_odometer ?? io.odometer ?? 0,
          },
          previousIgnition: device.prevIgnition,
        }

        await queues.alertQueue.add('check', alertJob, {
          priority: record.priority === 2 ? 1 : 10, // Panic = highest priority
        })

        // Update cached ignition state
        device.prevIgnition = io.ignition ?? false
      }

      // 3. Update device last_seen
      await supabase
        .from('gps_devices')
        .update({
          last_seen: new Date().toISOString(),
          status: 'online',
        })
        .eq('imei', imei)
    },
    {
      connection,
      concurrency: 10, // process 10 jobs simultaneously
    }
  )
}

async function lookupDevice(
  supabase: SupabaseClient,
  imei: string
): Promise<{
  vehicleId: string
  companyId: string
  deviceId: string
  maxSpeed: number
  prevIgnition: boolean
} | null> {
  const cached = deviceCache.get(imei)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached
  }

  const { data, error } = await supabase
    .from('gps_devices')
    .select(`
      id,
      company_id,
      vehicles!inner(id, max_speed)
    `)
    .eq('imei', imei)
    .single()

  if (error || !data) return null

  const vehicle = Array.isArray(data.vehicles) ? data.vehicles[0] : data.vehicles
  if (!vehicle) return null

  const entry = {
    vehicleId:    vehicle.id as string,
    companyId:    data.company_id as string,
    deviceId:     data.id as string,
    maxSpeed:     (vehicle as { id: string; max_speed: number }).max_speed ?? 120,
    prevIgnition: false,
    cachedAt:     Date.now(),
  }

  deviceCache.set(imei, entry)
  return entry
}

function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
