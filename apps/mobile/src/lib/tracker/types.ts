export const TRACKING_TASK = 'trackpro-background-location'

export const TRACKING_INTERVALS = [5, 10, 30, 60, 300] as const

export type TrackingInterval = typeof TRACKING_INTERVALS[number]

export interface TrackerDevice {
  device_id: string
  vehicle_id: string
  imei: string
  tracking_enabled: boolean
  tracking_interval_sec: number
}

export interface TelemetryPointPayload {
  lat: number
  lng: number
  speed: number
  heading: number
  altitude?: number | null
  accuracy?: number | null
  recorded_at: string
  battery_pct?: number | null
  battery_charging?: boolean | null
  connection_type?: string | null
  gps_enabled?: boolean | null
  internet_available?: boolean | null
  is_moving?: boolean | null
  activity?: string | null
  mock_location?: boolean | null
}
