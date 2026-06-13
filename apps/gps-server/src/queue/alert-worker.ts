// ============================================================
// Alert Worker
// Evaluates alert rules for each GPS position update
// ============================================================

import { Worker, type Job } from 'bullmq'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type IORedis from 'ioredis'
import {
  QUEUE_NAMES,
  type AlertCheckJob,
  type NotificationJob,
  type Queues,
} from './queues.js'

export function createAlertWorker(
  connection: IORedis,
  queues: Queues
): Worker<AlertCheckJob> {
  const supabase = createSupabaseServiceClient()

  return new Worker<AlertCheckJob>(
    QUEUE_NAMES.ALERT_CHECKS,
    async (job: Job<AlertCheckJob>) => {
      const { vehicleId, companyId, position, previousIgnition } = job.data

      // Load active rules for this company/vehicle
      const { data: rules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .or(`vehicle_ids.is.null,vehicle_ids.cs.{${vehicleId}}`)

      if (!rules?.length) return

      const alerts: Array<{
        type: string
        severity: string
        title: string
        message: string
        rule_id: string
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
            // Movement outside scheduled hours or without ignition authorization
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
            // Geofence checking via PostGIS in Postgres
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

      // Insert alerts and queue notifications
      for (const alert of alerts) {
        const { data: inserted, error } = await supabase
          .from('alerts')
          .insert({
            company_id: companyId,
            vehicle_id: vehicleId,
            rule_id:    alert.rule_id,
            type:       alert.type,
            severity:   alert.severity,
            title:      alert.title,
            message:    alert.message,
            lat:        position.lat,
            lng:        position.lng,
            speed:      position.speed,
            payload:    { position },
          })
          .select('id')
          .single()

        if (!error && inserted) {
          const notifJob: NotificationJob = {
            alertId:   inserted.id as string,
            companyId,
            vehicleId,
            channels:  alert.channels,
          }
          await queues.notificationQueue.add('notify', notifJob)
        }
      }
    },
    {
      connection,
      concurrency: 20,
    }
  )
}

function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']!
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
