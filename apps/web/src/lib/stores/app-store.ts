import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Company, Plan } from '@gps-saas/types'

interface AppState {
  user: User | null
  company: Company | null
  plan: Plan | null
  isLoading: boolean

  setUser: (user: User | null) => void
  setCompany: (company: Company | null) => void
  setPlan: (plan: Plan | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user:      null,
      company:   null,
      plan:      null,
      isLoading: false,

      setUser:    (user)    => set({ user }),
      setCompany: (company) => set({ company }),
      setPlan:    (plan)    => set({ plan }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ user: null, company: null, plan: null }),
    }),
    {
      name: 'gps-saas-app',
      partialize: (state) => ({
        user:    state.user,
        company: state.company,
        plan:    state.plan,
      }),
    }
  )
)

// Map store for real-time vehicle positions
interface MapState {
  vehicles: Map<string, {
    vehicleId: string
    lat: number
    lng: number
    speed: number
    heading: number
    ignition: boolean
    lastUpdate: string
    economicNum: string
    plates: string
  }>
  selectedVehicleId: string | null
  mapCenter: { lat: number; lng: number }
  mapZoom: number
  filter: 'all' | 'online' | 'offline' | 'moving' | 'stopped'

  updateVehicle: (vehicleId: string, data: Partial<MapState['vehicles'] extends Map<string, infer V> ? V : never>) => void
  setSelectedVehicle: (id: string | null) => void
  setMapCenter: (center: { lat: number; lng: number }) => void
  setMapZoom: (zoom: number) => void
  setFilter: (filter: MapState['filter']) => void
}

export const useMapStore = create<MapState>()((set, get) => ({
  vehicles: new Map(),
  selectedVehicleId: null,
  mapCenter: { lat: 19.4326, lng: -99.1332 }, // CDMX default
  mapZoom: 12,
  filter: 'all',

  updateVehicle: (vehicleId, data) => {
    set((state) => {
      const newMap = new Map(state.vehicles)
      const existing = newMap.get(vehicleId) ?? {}
      newMap.set(vehicleId, { ...existing, vehicleId, ...data } as typeof existing)
      return { vehicles: newMap }
    })
  },

  setSelectedVehicle: (id) => set({ selectedVehicleId: id }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setFilter: (filter) => set({ filter }),
}))
