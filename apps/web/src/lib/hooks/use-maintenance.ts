'use client'

import { useQuery } from '@tanstack/react-query'

export interface UpcomingMaintenance {
  vehicle_id:        string
  economic_num:      string
  plates:            string
  maintenance_type:  string
  description:       string
  next_service_date: string | null
  next_odometer:     number | null
  current_odometer:  number | null
  km_remaining:      number | null
  days_remaining:    number | null
  is_overdue:        boolean
}

async function fetchUpcomingMaintenance(daysAhead = 30): Promise<UpcomingMaintenance[]> {
  const res  = await fetch(`/api/maintenance/upcoming?days_ahead=${daysAhead}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.data ?? []
}

export function useUpcomingMaintenance(daysAhead = 30) {
  return useQuery({
    queryKey: ['maintenance', 'upcoming', daysAhead],
    queryFn:  () => fetchUpcomingMaintenance(daysAhead),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}
