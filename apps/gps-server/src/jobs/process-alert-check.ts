import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '../lib/supabase.js'
import { sendAlertNotifications } from '../notifications/send-alert.js'
import type { AlertCheckJob, NotificationJob, Queues } from '../queue/queues.js'

type AlertRule = {
  id: string
  type: string
  config: Record<string, unknown>
  channels: string[]
  vehicle_ids: string[] | null
}

const rulesCache = new Map<string, { rules: AlertRule[]; cachedAt: number }>()
const RULES_CACHE_TTL_MS = 3 * 60 * 1000

async function getRulesForVehicle(
  supabase: SupabaseClient,
  companyId: string,
  vehicleId: string,
): Promise<AlertRule[]> {
  const cached = rulesCache.get(companyId)
  if (cached && Date.now() - cached.cachedAt < RULES_CACHE_TTL_MS) {
    return cached.rules.filter(
      (r) => !r.vehicle_ids?.length || r.vehicle_ids.includes(vehicleId),
    )
  }

  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id, type, config, channels, vehicle_ids')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const allRules = (rules ?? []) as AlertRule[]
  rulesCache.set(companyId, { rules: allRules, cachedAt: Date.now() })

  return allRules.filter(
    (r) => !r.vehicle_ids?.length || r.vehicle_ids.includes(vehicleId),
  )
}

export async function processAlertCheck(
  job: AlertCheckJob,
  queues: Queues,
  supabase: SupabaseClient = createSupabaseServiceClient(),
): Promise<void> {
  const { vehicleId, companyId, position, previousIgnition } = job
  const rules = await getRulesForVehicle(supabase, companyId, vehicleId)

  const alerts: Array<{
    type: string
    severity: string
    title: string
    message: string
    rule_id: string | null
    geofence_id?: string
    channels: string[]
  }> = []

  for (const rule of rules) {
    const config = rule.config as Record<string, unknown>

    switch (rule.type) {
      case 'speed_excess': {
        const limit = (config['speed_limit'] as number) ?? 120
        if (position.speed > limit) {
          alerts.push({
            type:     'speed_excess',
            severity: position.speed > limit * 1.3 ? 'critical' : 'high',
            title:    'Exceso de velocidad',
            message:  `Velocidad detectada: ${position.speed} km/h (límite: ${limit} km/h)`,
            rule_id:  rule.id as string,
            channels: rule.channels as string[],
          })
        }
        break
      }

      case 'ignition_on': {
        if (position.ignition && previousIgnition === false) {
          alerts.push({
            type:     'ignition_on',
            severity: 'low',
            title:    'Motor encendido',
            message:  'La unidad ha sido encendida',
            rule_id:  rule.id as string,
            channels: rule.channels as string[],
          })
        }
        break
      }

      case 'ignition_off': {
        if (!position.ignition && previousIgnition === true) {
          alerts.push({
            type:     'ignition_off',
            severity: 'low',
            title:    'Motor apagado',
            message:  'La unidad ha sido apagada',
            rule_id:  rule.id as string,
            channels: rule.channels as string[],
          })
        }
        break
      }

      case 'unauthorized_movement': {
        if (position.speed > 5 && !position.ignition) {
          alerts.push({
            type:     'unauthorized_movement',
            severity: 'critical',
            title:    'Movimiento no autorizado',
            message:  `Movimiento detectado a ${position.speed} km/h sin ignición activa`,
            rule_id:  rule.id as string,
            channels: rule.channels as string[],
          })
        }
        break
      }

      case 'geofence_enter':
      case 'geofence_exit': {
        const geofenceId = config['geofence_id'] as string | undefined
        if (geofenceId) {
          const { data: event } = await supabase.rpc('check_geofence_event', {
            p_vehicle_id:  vehicleId,
            p_geofence_id: geofenceId,
            p_lat:         position.lat,
            p_lng:         position.lng,
          })

          if (event && event !== 'none') {
            const isEnter = event === 'enter'
            if (
              (isEnter && rule.type === 'geofence_enter') ||
              (!isEnter && rule.type === 'geofence_exit')
            ) {
              alerts.push({
                type:     rule.type as string,
                severity: 'medium',
                title:    isEnter ? 'Entrada a geocerca' : 'Salida de geocerca',
                message:  isEnter
                  ? 'La unidad ha entrado en la zona delimitada'
                  : 'La unidad ha salido de la zona delimitada',
                rule_id:  rule.id as string,
                channels: rule.channels as string[],
              })
            }
          }
        }
        break
      }
    }
  }

  const { data: geoEvents } = await supabase.rpc('get_geofence_events', {
    p_company_id: companyId,
    p_vehicle_id: vehicleId,
    p_lat:        position.lat,
    p_lng:        position.lng,
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
        type:        isEnter ? 'geofence_enter' : 'geofence_exit',
        severity:    'medium',
        title:       isEnter ? `Entrada: ${evt.geofence_name}` : `Salida: ${evt.geofence_name}`,
        message:     isEnter
          ? `La unidad entró en la zona "${evt.geofence_name}"`
          : `La unidad salió de la zona "${evt.geofence_name}"`,
        rule_id:     null,
        geofence_id: evt.geofence_id,
        channels:    ['platform', 'email'],
      })
    }
  }

  for (const alert of alerts) {
    const { data: inserted, error } = await supabase
      .from('alerts')
      .insert({
        company_id:  companyId,
        vehicle_id:  vehicleId,
        rule_id:     alert.rule_id,
        geofence_id: alert.geofence_id ?? null,
        type:        alert.type,
        severity:    alert.severity,
        title:       alert.title,
        message:     alert.message,
        lat:         position.lat,
        lng:         position.lng,
        speed:       position.speed,
        payload:     { position },
      })
      .select('id')
      .single()

    if (!error && inserted) {
      await enqueueNotification(queues, supabase, {
        alertId:   inserted.id as string,
        companyId,
        vehicleId,
        channels:  alert.channels,
      })
    }
  }
}

async function enqueueNotification(
  queues: Queues,
  supabase: SupabaseClient,
  notifJob: NotificationJob,
): Promise<void> {
  const externalChannels = notifJob.channels.filter((c) => c !== 'platform')
  if (!externalChannels.length) return

  try {
    await queues.notificationQueue.add('notify', { ...notifJob, channels: externalChannels })
  } catch (err) {
    console.warn('[Alert] Notification queue unavailable, sending inline:', err instanceof Error ? err.message : err)
    await sendAlertNotifications(supabase, {
      alertId: notifJob.alertId,
      companyId: notifJob.companyId,
      vehicleId: notifJob.vehicleId,
      channels: externalChannels,
    })
  }
}
