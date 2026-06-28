import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TrackerDevice } from '../lib/tracker/types'

const STORAGE_KEY = 'trackpro_tracker_state'

interface TrackerState {
  deviceId: string | null
  deviceUid: string | null
  vehicleId: string | null
  trackingEnabled: boolean
  trackingIntervalSec: number
  lastSync: string | null
  lastError: string | null
  isRegistering: boolean

  hydrate: () => Promise<void>
  persist: () => Promise<void>
  setDevice: (d: TrackerDevice, deviceUid: string) => void
  setTrackingEnabled: (v: boolean) => void
  setTrackingInterval: (sec: number) => void
  setLastSync: (iso: string) => void
  setLastError: (msg: string | null) => void
  setRegistering: (v: boolean) => void
  clear: () => void
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  deviceId: null,
  deviceUid: null,
  vehicleId: null,
  trackingEnabled: false,
  trackingIntervalSec: 30,
  lastSync: null,
  lastError: null,
  isRegistering: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      set(data)
    } catch { /* ignore */ }
  },

  persist: async () => {
    const s = get()
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      deviceId: s.deviceId,
      deviceUid: s.deviceUid,
      vehicleId: s.vehicleId,
      trackingEnabled: s.trackingEnabled,
      trackingIntervalSec: s.trackingIntervalSec,
      lastSync: s.lastSync,
    }))
  },

  setDevice: (d, deviceUid) => {
    set({
      deviceId: d.device_id,
      deviceUid,
      vehicleId: d.vehicle_id,
      trackingEnabled: d.tracking_enabled,
      trackingIntervalSec: d.tracking_interval_sec,
    })
    void get().persist()
  },

  setTrackingEnabled: (v) => { set({ trackingEnabled: v }); void get().persist() },
  setTrackingInterval: (sec) => { set({ trackingIntervalSec: sec }); void get().persist() },
  setLastSync: (iso) => set({ lastSync: iso }),
  setLastError: (msg) => set({ lastError: msg }),
  setRegistering: (v) => set({ isRegistering: v }),

  clear: () => {
    set({
      deviceId: null, deviceUid: null, vehicleId: null,
      trackingEnabled: false, lastSync: null, lastError: null,
    })
    void AsyncStorage.removeItem(STORAGE_KEY)
  },
}))
