import type { SupabaseClient } from '@supabase/supabase-js'
import { processMobileAlertsInline } from './alert-processor-inline'
import type { MobileTelemetryPoint } from './schemas'

type DeviceContext = {
  deviceId: string
  companyId: string
  vehicleId: string
  maxSpeed: number
}

const prevIgnition = new Map<string, boolean>()

export async function processMobileTelemetry(
  supabase: SupabaseClient,
  device: DeviceContext,
  points: MobileTelemetryPoint[],
): Promise<{ processed: number; skipped: number }> {
  let processed = 0
  let skipped = 0
  const serverAt = new Date().toISOString()
  const cacheKey = device.vehicleId

  for (const pt of points) {
    const recordedAt = new Date(pt.recorded_at)
    if (Number.isNaN(recordedAt.getTime())) {
      skipped++
      continue
    }

    const isMoving = pt.is_moving ?? pt.speed > 2
    const ignition = isMoving || (pt.activity !== 'still' && pt.activity != null)

    const rawIo: Record<string, unknown> = {
      source: 'mobile_app',
      battery_pct: pt.battery_pct,
      battery_charging: pt.battery_charging,
      connection_type: pt.connection_type,
      gps_enabled: pt.gps_enabled,
      internet_available: pt.internet_available,
      activity: pt.activity,
      accuracy: pt.accuracy,
      mock_location: pt.mock_location,
    }

    const position = {
      vehicle_id: device.vehicleId,
      company_id: device.companyId,
      device_id: device.deviceId,
      lat: pt.lat,
      lng: pt.lng,
      speed: Math.round(pt.speed),
      heading: Math.round(pt.heading),
      altitude: pt.altitude ?? null,
      ignition,
      odometer: 0,
      gsm_signal: pt.internet_available ? 100 : 0,
      battery_lvl: pt.battery_pct ?? 0,
      satellites: pt.gps_enabled ? 8 : 0,
      raw_io: rawIo,
      recorded_at: recordedAt.toISOString(),
      server_at: serverAt,
    }

    const { error: upsertError } = await supabase
      .from('vehicle_positions')
      .upsert(position, { onConflict: 'vehicle_id' })

    if (upsertError) {
      skipped++
      continue
    }

    await supabase.from('position_history').insert(position)

    const previous = prevIgnition.get(cacheKey) ?? false
    await processMobileAlertsInline(supabase, {
      vehicleId: device.vehicleId,
      companyId: device.companyId,
      position: {
        lat: pt.lat,
        lng: pt.lng,
        speed: position.speed,
        ignition,
        odometer: 0,
      },
      previousIgnition: previous,
      batteryPct: pt.battery_pct,
      mockLocation: pt.mock_location,
    })
    prevIgnition.set(cacheKey, ignition)
    processed++
  }

  if (processed > 0) {
    await supabase
      .from('gps_devices')
      .update({ last_seen: serverAt, status: 'online', updated_at: serverAt })
      .eq('id', device.deviceId)
  }

  return { processed, skipped }
}
