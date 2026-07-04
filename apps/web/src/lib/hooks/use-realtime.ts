'use client'

import { useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useMapStore } from '@/lib/stores/app-store'
import type { LiveVehicle, VehiclePosition } from '@gps-saas/types'

const IS_DEMO = process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true'
const BATCH_INTERVAL_MS = 1000
const POLL_INTERVAL_MS = 8000
const supabase = createSupabaseBrowserClient()

/** Batch realtime updates — 1 render per second max at 500 devices */
export function useRealtimeVehicles(companyId: string) {
  const updateVehiclesBatch = useMapStore((s) => s.updateVehiclesBatch)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollAbortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(new Map<string, {
    lat: number
    lng: number
    speed: number
    heading: number
    ignition: boolean
    lastUpdate: string
    batteryPct: number | null
  }>())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!companyId || IS_DEMO) return

    const flush = () => {
      const batch = pendingRef.current
      if (batch.size === 0) return
      pendingRef.current = new Map()
      updateVehiclesBatch(batch)
    }

    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS)

    const pollLatestPositions = async () => {
      pollAbortRef.current?.abort()
      const controller = new AbortController()
      pollAbortRef.current = controller
      try {
        const res = await fetch('/api/map/positions', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = await res.json() as { data?: LiveVehicle[] }
        const updates = new Map<string, Partial<LiveVehicle>>()
        for (const vehicle of json.data ?? []) {
          updates.set(vehicle.vehicle_id, toMapUpdate(vehicle))
        }
        updateVehiclesBatch(updates as never)
      } catch {
        // Realtime remains active; polling is only a fallback.
      }
    }

    void pollLatestPositions()
    const pollTimer = setInterval(() => void pollLatestPositions(), POLL_INTERVAL_MS)

    const channel = supabase
      .channel(`vehicle_positions:${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'vehicle_positions',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const pos = payload.new as VehiclePosition
          if (!pos.vehicle_id) return

          pendingRef.current.set(pos.vehicle_id, {
            lat:        pos.lat,
            lng:        pos.lng,
            speed:      pos.speed,
            heading:    pos.heading,
            ignition:   pos.ignition,
            lastUpdate: pos.recorded_at,
            batteryPct: readBatteryPct(pos),
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      pollAbortRef.current?.abort()
      clearInterval(pollTimer)
      if (timerRef.current) clearInterval(timerRef.current)
      flush()
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [companyId, updateVehiclesBatch])
}

function toMapUpdate(vehicle: LiveVehicle) {
  return {
    lat: vehicle.lat,
    lng: vehicle.lng,
    speed: vehicle.speed,
    heading: vehicle.heading,
    ignition: vehicle.ignition,
    lastUpdate: vehicle.last_update,
    batteryPct: vehicle.battery_pct ?? null,
    deviceId: vehicle.device_id ?? null,
    economicNum: vehicle.economic_num,
    plates: vehicle.plates,
    vehicleType: vehicle.vehicle_type,
    deviceSource: vehicle.device_source ?? 'hardware',
    mobilePlatform: vehicle.mobile_platform ?? null,
    groupId: vehicle.group_id ?? null,
    groupName: vehicle.group_name ?? null,
    ownerName: vehicle.owner_name ?? null,
    driverName: vehicle.driver_name ?? null,
  }
}

function readBatteryPct(pos: VehiclePosition): number | null {
  const rawBattery = pos.raw_io?.battery_pct
  if (typeof rawBattery === 'number') return rawBattery
  return pos.battery_lvl > 0 ? pos.battery_lvl : null
}

/** @deprecated Usar useAlertsRealtime del AlertsRealtimeProvider */
export function useRealtimeAlerts(companyId: string, onAlert?: (alert: unknown) => void) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!companyId || IS_DEMO || !onAlert) return

    const channel = supabase
      .channel(`alerts_legacy:${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'alerts',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          onAlert(payload.new)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [companyId, onAlert])
}
