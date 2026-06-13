'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AlertFilters {
  page?:           number
  per_page?:       number
  severity?:       string
  type?:           string
  unacknowledged?: boolean
  date_from?:      string
  date_to?:        string
}

async function fetchAlerts(filters: AlertFilters = {}) {
  const params = new URLSearchParams()
  if (filters.page)           params.set('page',           String(filters.page))
  if (filters.per_page)       params.set('per_page',       String(filters.per_page))
  if (filters.severity)       params.set('severity',       filters.severity)
  if (filters.type)           params.set('type',           filters.type)
  if (filters.unacknowledged) params.set('unacknowledged', 'true')
  if (filters.date_from)      params.set('date_from',      filters.date_from)
  if (filters.date_to)        params.set('date_to',        filters.date_to)

  const res = await fetch(`/api/alerts?${params}`)
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}

export function useAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn:  () => fetchAlerts(filters),
    staleTime: 10 * 1000, // 10s — alerts are time-sensitive
    refetchInterval: 30 * 1000, // refresh every 30s
  })
}

export function useAcknowledgeAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (alertIds: string[]) => {
      const res = await fetch('/api/alerts', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ alert_ids: alertIds }),
      })
      if (!res.ok) throw new Error('Error acknowledging alerts')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/alerts/${alertId}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Error acknowledging alert')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
