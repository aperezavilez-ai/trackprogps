import type { SupabaseClient } from '@supabase/supabase-js'
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
    throw new Error(error?.message ?? 'Error al registrar evento móvil')
  }

  let alertId: string | undefined

  if (input.eventType === 'sos' && input.lat != null && input.lng != null) {
    const { data: alert } = await supabase
      .from('alerts')
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        type: 'sos',
        severity: 'critical',
        title: 'SOS — Emergencia móvil',
        message: 'Botón de emergencia activado desde dispositivo móvil',
        lat: input.lat,
        lng: input.lng,
        speed: 0,
        payload: { ...input.payload, mobile_event_id: event.id, source: 'mobile_sos' },
      })
      .select('id')
      .single()

    alertId = alert?.id

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
