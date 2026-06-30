import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '../lib/supabase.js'
import { batchUpsertPositions } from '../lib/batch-positions.js'
import { LruCache } from '../lib/lru-cache.js'
import type { AlertCheckJob, GpsPositionJob, Queues } from '../queue/queues.js'
import { processAlertCheck } from './process-alert-check.js'

const deviceCache = new LruCache<string, {
  vehicleId: string
  companyId: string
  deviceId: string
  maxSpeed: number
  prevIgnition: boolean
  cachedAt: number
}>(5000)

const CACHE_TTL_MS = 5 * 60 * 1000

export async function processGpsPosition(
  data: GpsPositionJob,
  queues: Queues,
  supabase: SupabaseClient = createSupabaseServiceClient(),
): Promise<void> {
  const { imei, protocolId, records, receivedAt } = data
  const device = await lookupDevice(supabase, imei)
  if (!device) {
    await upsertProvisioningCandidate(supabase, imei, protocolId, records[0])
    const masked = imei.length > 4 ? `***${imei.slice(-4)}` : '****'
    console.warn(`[GPS Worker] Unknown IMEI: ${masked} - provisioning candidate recorded`)
    return
  }

  const positions = records.map(record => {
    const io = record.io_elements
    return {
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
      raw_io:      io as Record<string, unknown>,
      recorded_at: new Date(record.timestamp as string | Date).toISOString(),
      server_at:   receivedAt,
    }
  })

  if (positions.length > 0) {
    try {
      await batchUpsertPositions(supabase, positions)
    } catch (err) {
      console.error('[GPS Worker] Batch upsert error:', err instanceof Error ? err.message : err)
      throw err
    }
  }

  for (const record of records) {
    const io = record.io_elements
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

async function upsertProvisioningCandidate(
  supabase: SupabaseClient,
  imei: string,
  adapterKey: string | undefined,
  firstRecord: GpsPositionJob['records'][number] | undefined,
): Promise<void> {
  try {
    let protocolId: string | null = null
    if (adapterKey) {
      const { data: protocol } = await supabase
        .from('gps_protocols')
        .select('id')
        .eq('adapter_key', adapterKey)
        .maybeSingle()

      protocolId = (protocol?.id as string | undefined) ?? null
    }

    const samplePayload: Record<string, unknown> = {
      adapter_key: adapterKey ?? null,
      last_record: firstRecord
        ? {
            recorded_at: new Date(firstRecord.timestamp as string | Date).toISOString(),
            lat: firstRecord.lat,
            lng: firstRecord.lng,
            speed: firstRecord.speed,
            io_elements: firstRecord.io_elements,
          }
        : null,
    }

    const row: Record<string, unknown> = {
      imei,
      source_type: 'hardware',
      status: protocolId ? 'detected' : 'pending_autodetect',
      confidence: protocolId ? 90 : 25,
      last_seen_at: new Date().toISOString(),
      sample_payload: samplePayload,
    }
    if (protocolId) row['protocol_id'] = protocolId

    await supabase
      .from('gps_provisioning_candidates')
      .upsert(row, { onConflict: 'imei' })
  } catch (err) {
    console.warn('[GPS Worker] Unable to record provisioning candidate:', err instanceof Error ? err.message : err)
  }
}
