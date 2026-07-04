import type { SupabaseClient } from '@supabase/supabase-js'
import { dispatchWebhooks } from '@/lib/webhooks/dispatch'
import { processMobileAlertsInline } from './alert-processor-inline'

type EventInput = {
  deviceId: string
  vehicleId: string
  companyId: string
  userId: string
  eventType: string
  lat?: number | null
  lng?: number | null
  payload?: Record<string, unknown>
}

export async function processMobileEvent(
  supabase: SupabaseClient,
  input: EventInput,
): Promise<{ event_id: string; alert_id?: string }> {
  const { data: event, error } = await supabase
    .from('mobile_events')
    .insert({
      company_id: input.companyId,
      device_id: input.deviceId,
      vehicle_id: input.vehicleId,
      user_id: input.userId,
      event_type: input.eventType,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      payload: input.payload ?? {},
    })
    .select('id')
    .single()

  if (error || !event) {
    throw new Error(error?.message ?? 'Error al registrar evento movil')
  }

  let alertId: string | undefined

  if (input.eventType === 'sos' && input.lat != null && input.lng != null) {
    const emergencyRouting = await getDeviceEmergencyRouting(supabase, input.deviceId)
    const mapsUrl = `https://www.google.com/maps?q=${input.lat},${input.lng}`
    const sosMessage = buildSosMessage({
      lat: input.lat,
      lng: input.lng,
      mapsUrl,
      payload: input.payload ?? {},
      routing: emergencyRouting,
    })

    const { data: alert } = await supabase
      .from('alerts')
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        type: 'sos',
        severity: 'critical',
        title: 'SOS - Emergencia movil',
        message: sosMessage,
        lat: input.lat,
        lng: input.lng,
        speed: 0,
        payload: {
          ...input.payload,
          mobile_event_id: event.id,
          source: 'mobile_sos',
          maps_url: mapsUrl,
          ...emergencyRouting,
        },
      })
      .select('id')
      .single()

    alertId = alert?.id

    if (alertId) {
      void dispatchWebhooks(supabase, input.companyId, 'mobile.sos', {
        alert_id: alertId,
        event_id: event.id,
        device_id: input.deviceId,
        vehicle_id: input.vehicleId,
        type: 'sos',
        severity: 'critical',
        title: 'SOS - Emergencia movil',
        message: sosMessage,
        lat: input.lat,
        lng: input.lng,
        maps_url: mapsUrl,
        ...emergencyRouting,
      })
    }

    await processMobileAlertsInline(supabase, {
      vehicleId: input.vehicleId,
      companyId: input.companyId,
      position: { lat: input.lat, lng: input.lng, speed: 0, ignition: true, odometer: 0 },
      previousIgnition: false,
    })
  }

  if (['check_in', 'check_out'].includes(input.eventType)) {
    await supabase.from('mobile_field_actions').insert({
      company_id: input.companyId,
      device_id: input.deviceId,
      vehicle_id: input.vehicleId,
      user_id: input.userId,
      action_type: input.eventType,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      notes: (input.payload?.notes as string) ?? null,
      metadata: input.payload ?? {},
    })
  }

  return { event_id: event.id, alert_id: alertId }
}

async function getDeviceEmergencyRouting(
  supabase: SupabaseClient,
  deviceId: string,
): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from('gps_devices')
    .select('source_type, imei, model, phone_num, mobile_metadata, protocol_metadata')
    .eq('id', deviceId)
    .maybeSingle()

  const metadata = data?.source_type === 'mobile' ? data.mobile_metadata : data?.protocol_metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      device: {
        imei: data?.imei ?? null,
        model: data?.model ?? null,
        phone_num: data?.phone_num ?? null,
      },
    }
  }

  return {
    device: {
      imei: data?.imei ?? null,
      model: data?.model ?? null,
      phone_num: data?.phone_num ?? null,
    },
    device_owner: (metadata as Record<string, unknown>).device_owner ?? null,
    responsible_contact: (metadata as Record<string, unknown>).responsible_contact ?? null,
    emergency_contacts: (metadata as Record<string, unknown>).emergency_contacts ?? [],
  }
}

function buildSosMessage(opts: {
  lat: number
  lng: number
  mapsUrl: string
  payload: Record<string, unknown>
  routing: Record<string, unknown>
}) {
  const owner = readObject(opts.routing.device_owner)
  const responsible = readObject(opts.routing.responsible_contact)
  const device = readObject(opts.routing.device)
  const who = readString(owner?.name) || readString(responsible?.name) || readString(device?.model) || 'Dispositivo movil'
  const recordedAt = readString(opts.payload.recorded_at)
  const accuracy = typeof opts.payload.accuracy_m === 'number' ? Math.round(opts.payload.accuracy_m) : null
  const battery = typeof opts.payload.battery_pct === 'number' ? `${opts.payload.battery_pct}%` : null
  const parts = [
    `SOS TrackProGPS: ${who} activo el boton de panico.`,
    `Ubicacion: ${opts.mapsUrl}`,
    `Coordenadas: ${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)}`,
    recordedAt ? `Hora del telefono: ${new Date(recordedAt).toLocaleString('es-MX')}` : null,
    accuracy != null ? `Precision: ${accuracy} m` : null,
    battery ? `Bateria: ${battery}` : null,
    readString(owner?.phone) ? `Telefono propietario: ${readString(owner?.phone)}` : null,
    readString(responsible?.phone) ? `Responsable: ${readString(responsible?.phone)}` : null,
  ].filter(Boolean)

  return parts.join(' | ')
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function readString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}
