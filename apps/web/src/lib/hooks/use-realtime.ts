'use client'

import { useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useMapStore } from '@/lib/stores/app-store'
import type { VehiclePosition } from '@gps-saas/types'

export function useRealtimeVehicles(companyId: string) {
  const supabase = createSupabaseBrowserClient()
  const updateVehicle = useMapStore((s) => s.updateVehicle)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!companyId) return

    // Subscribe to vehicle_positions changes filtered by company
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

          updateVehicle(pos.vehicle_id, {
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
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [companyId, supabase, updateVehicle])
}

export function useRealtimeAlerts(companyId: string, onAlert?: (alert: unknown) => void) {
  const supabase = createSupabaseBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!companyId) return

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
