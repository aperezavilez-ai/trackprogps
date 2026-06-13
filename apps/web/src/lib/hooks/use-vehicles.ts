'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface VehicleFilters {
  page?:     number
  per_page?: number
  search?:   string
  status?:   string
}

async function fetchVehicles(filters: VehicleFilters = {}) {
  const params = new URLSearchParams()
  if (filters.page)     params.set('page',     String(filters.page))
  if (filters.per_page) params.set('per_page', String(filters.per_page))
  if (filters.search)   params.set('search',   filters.search)
  if (filters.status)   params.set('status',   filters.status)

  const res  = await fetch(`/api/vehicles?${params}`)
  if (!res.ok) throw new Error('Failed to fetch vehicles')
  return res.json()
}

export function useVehicles(filters: VehicleFilters = {}) {
  return useQuery({
    queryKey: ['vehicles', filters],
    queryFn:  () => fetchVehicles(filters),
    staleTime: 30 * 1000,
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/vehicles', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error creating vehicle')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useUpdateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/vehicles/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error updating vehicle')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting vehicle')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}
