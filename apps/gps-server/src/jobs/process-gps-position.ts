import type { SupabaseClient } from '@supabase/supabase-js'
import type { TeltonikaRecord } from '@gps-saas/types'
import { createSupabaseServiceClient } from '../lib/supabase.js'
import type { AlertCheckJob, GpsPositionJob, Queues } from '../queue/queues.js'
import { processAlertCheck } from './process-alert-check.js'

const deviceCache = new Map<string, {
  vehicleId: string
  companyId: string
  deviceId: string
  maxSpeed: number
  prevIgnition: boolean
  cachedAt: number
}>()

const CACHE_TTL_MS = 5 * 60 * 1000

export async function processGpsPosition(
  data: GpsPositionJob,
  queues: Queues,
  supabase: SupabaseClient = createSupabaseServiceClient(),
): Promise<void> {
  const { imei, records, receivedAt } = data
  const device = await lookupDevice(supabase, imei)
  if (!device) {
    console.warn(`[GPS Worker] Unknown IMEI: ${imei} — skipping`)
    return
  }

  for (const record of records) {
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
      recorded_at: new Date(record.timestamp as string | Date).toISOString(),
      server_at:   receivedAt,
    }

    const { error: upsertError } = await supabase
      .from('vehicle_positions')
      .upsert({ ...position, id: undefined }, { onConflict: 'vehicle_id', ignoreDuplicates: false })

    if (upsertError) {
      console.error('[GPS Worker] Upsert error:', upsertError.message)
      throw upsertError
    }

    const { error: histError } = await supabase.from('position_history').insert(position)
    if (histError) {
      console.error('[GPS Worker] History insert error:', histError.message)
    }

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

    await enqueueAlertCheck(queues, alertJob, record.priority === 2 ? 1 : 10)
    device.prevIgnition = io.ignition ?? false
  }

  await supabase
    .from('gps_devices')
    .update({ last_seen: new Date().toISOString(), status: 'online' })
    .eq('imei', imei)
}

async function enqueueAlertCheck(queues: Queues, alertJob: AlertCheckJob, priority: number): Promise<void> {
  try {
    await queues.alertQueue.add('check', alertJob, { priority })
  } catch (err) {
    console.warn('[GPS] Alert queue unavailable, processing inline:', err instanceof Error ? err.message : err)
    await processAlertCheck(alertJob, queues)
  }
}

async function lookupDevice(
  supabase: SupabaseClient,
  imei: string,
): Promise<{
  vehicleId: string
  companyId: string
  deviceId: string
  maxSpeed: number
  prevIgnition: boolean
} | null> {
  const cached = deviceCache.get(imei)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached

  const { data, error } = await supabase
    .from('gps_devices')
    .select(`id, company_id, vehicles!inner(id, max_speed)`)
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
