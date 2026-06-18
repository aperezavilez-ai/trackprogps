'use client'

import { useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useMapStore } from '@/lib/stores/app-store'
import type { VehiclePosition } from '@gps-saas/types'

const IS_DEMO = process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true'

/** Batch realtime updates — 1 render per second max at 500 devices */
const BATCH_INTERVAL_MS = 1000

export function useRealtimeVehicles(companyId: string) {
  const supabase = createSupabaseBrowserClient()
  const updateVehiclesBatch = useMapStore((s) => s.updateVehiclesBatch)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pendingRef = useRef(new Map<string, {
    lat: number
    lng: number
    speed: number
    heading: number
    ignition: boolean
    lastUpdate: string
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
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      flush()
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [companyId, supabase, updateVehiclesBatch])
}

export function useRealtimeAlerts(companyId: string, onAlert?: (alert: unknown) => void) {
  const supabase = createSupabaseBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!companyId || IS_DEMO) return

    const channel = supabase
      .channel(`alerts:${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'alerts',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          onAlert?.(payload.new)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [companyId, supabase, onAlert])
}
