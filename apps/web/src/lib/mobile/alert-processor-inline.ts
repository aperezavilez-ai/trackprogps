import type { SupabaseClient } from '@supabase/supabase-js'
import { dispatchWebhooks, alertTypeToWebhookEvent } from '@/lib/webhooks/dispatch'

type AlertJob = {
  vehicleId: string
  companyId: string
  position: {
    lat: number
    lng: number
    speed: number
    ignition: boolean
    odometer: number
  }
  previousIgnition: boolean
  batteryPct?: number | null
  mockLocation?: boolean | null
}

/** Procesamiento inline de alertas para telemetría móvil (sin Redis). */
export async function processMobileAlertsInline(
  supabase: SupabaseClient,
  job: AlertJob,
): Promise<void> {
  const { vehicleId, companyId, position, previousIgnition, batteryPct, mockLocation } = job

  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id, type, config, channels, vehicle_ids')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const alerts: Array<{
    type: string
    severity: string
    title: string
    message: string
    rule_id: string | null
    geofence_id?: string
  }> = []

  for (const rule of rules ?? []) {
    if (rule.vehicle_ids?.length && !rule.vehicle_ids.includes(vehicleId)) continue
    const config = rule.config as Record<string, unknown>

    switch (rule.type) {
      case 'speed_excess': {
        const limit = (config['speed_limit'] as number) ?? 120
        if (position.speed > limit) {
          alerts.push({
            type: 'speed_excess',
            severity: position.speed > limit * 1.3 ? 'critical' : 'high',
            title: 'Exceso de velocidad',
            message: `Velocidad: ${position.speed} km/h (límite: ${limit} km/h)`,
            rule_id: rule.id,
          })
        }
        break
      }
      case 'ignition_on':
        if (position.ignition && !previousIgnition) {
          alerts.push({
            type: 'ignition_on',
            severity: 'low',
            title: 'Inicio de movimiento',
            message: 'La unidad móvil comenzó a moverse',
            rule_id: rule.id,
          })
        }
        break
      case 'ignition_off':
        if (!position.ignition && previousIgnition) {
          alerts.push({
            type: 'ignition_off',
            severity: 'low',
            title: 'Detención',
            message: 'La unidad móvil se detuvo',
            rule_id: rule.id,
          })
        }
        break
      default:
        break
    }
  }

  if (batteryPct != null && batteryPct <= 15) {
    alerts.push({
      type: 'battery_low',
      severity: batteryPct <= 5 ? 'critical' : 'high',
      title: 'Batería baja',
      message: `Batería del dispositivo móvil: ${batteryPct}%`,
      rule_id: null,
    })
  }

  if (mockLocation) {
    alerts.push({
      type: 'unauthorized_movement',
      severity: 'critical',
      title: 'Ubicación simulada detectada',
      message: 'El dispositivo móvil reporta GPS falso o mock location',
      rule_id: null,
    })
  }

  const { data: geoEvents } = await supabase.rpc('get_geofence_events', {
    p_company_id: companyId,
    p_vehicle_id: vehicleId,
    p_lat: position.lat,
    p_lng: position.lng,
  })

  for (const evt of (geoEvents ?? []) as Array<{
    geofence_id: string
    geofence_name: string
    event_type: string
    alert_on_enter: boolean
    alert_on_exit: boolean
  }>) {
    const isEnter = evt.event_type === 'enter'
    if ((isEnter && evt.alert_on_enter) || (!isEnter && evt.alert_on_exit)) {
      alerts.push({
        type: isEnter ? 'geofence_enter' : 'geofence_exit',
        severity: 'medium',
        title: isEnter ? `Entrada: ${evt.geofence_name}` : `Salida: ${evt.geofence_name}`,
        message: isEnter
          ? `Entró en "${evt.geofence_name}"`
          : `Salió de "${evt.geofence_name}"`,
        rule_id: null,
        geofence_id: evt.geofence_id,
      })
    }
  }

  for (const alert of alerts) {
    const { data: inserted } = await supabase.from('alerts').insert({
      company_id: companyId,
      vehicle_id: vehicleId,
      rule_id: alert.rule_id,
      geofence_id: alert.geofence_id ?? null,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      lat: position.lat,
      lng: position.lng,
      speed: position.speed,
      payload: { source: 'mobile_app', position },
    }).select('id').single()

    if (inserted?.id) {
      void dispatchWebhooks(supabase, companyId, alertTypeToWebhookEvent(alert.type), {
        alert_id: inserted.id,
        vehicle_id: vehicleId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        lat: position.lat,
        lng: position.lng,
        speed: position.speed,
      })
    }
  }
}
