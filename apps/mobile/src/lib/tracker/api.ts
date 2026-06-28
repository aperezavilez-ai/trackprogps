import { supabase } from '../supabase'
import type { TrackerDevice, TelemetryPointPayload } from './types'

const API_BASE = process.env['EXPO_PUBLIC_APP_URL'] ?? 'https://trackprogps.mx'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sin sesión activa')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function apiFetch(path: string, init?: RequestInit) {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> ?? {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`)
  }
  return json
}

export async function registerMobileDevice(input: {
  device_uid: string
  platform: 'android' | 'ios'
  brand?: string | null
  model?: string | null
  os_version?: string | null
  app_version?: string | null
  push_token?: string | null
  permissions?: Record<string, boolean>
}): Promise<TrackerDevice> {
  const json = await apiFetch('/api/mobile/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return json.data
}

export async function sendTelemetry(
  deviceId: string,
  deviceUid: string,
  points: TelemetryPointPayload[],
) {
  return apiFetch('/api/mobile/telemetry', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, device_uid: deviceUid, points }),
  })
}

export async function sendMobileEvent(
  deviceId: string,
  deviceUid: string,
  eventType: string,
  lat?: number,
  lng?: number,
  payload?: Record<string, unknown>,
) {
  return apiFetch('/api/mobile/events', {
    method: 'POST',
    body: JSON.stringify({
      device_id: deviceId,
      device_uid: deviceUid,
      event_type: eventType,
      lat,
      lng,
      payload,
    }),
  })
}

export async function sendSos(
  deviceId: string,
  deviceUid: string,
  lat: number,
  lng: number,
  batteryPct?: number | null,
) {
  return apiFetch('/api/mobile/sos', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, device_uid: deviceUid, lat, lng, battery_pct: batteryPct }),
  })
}

export async function fetchTrackerConfig(deviceId: string, deviceUid: string) {
  const params = new URLSearchParams({ device_id: deviceId, device_uid: deviceUid })
  const json = await apiFetch(`/api/mobile/config?${params}`)
  return json.data
}

export async function updateTrackerConfig(
  deviceId: string,
  deviceUid: string,
  config: { tracking_enabled?: boolean; tracking_interval_sec?: number },
) {
  return apiFetch('/api/mobile/config', {
    method: 'PATCH',
    body: JSON.stringify({ device_id: deviceId, device_uid: deviceUid, ...config }),
  })
}

export async function checkIn(
  deviceId: string,
  deviceUid: string,
  action: 'check_in' | 'check_out',
  lat?: number,
  lng?: number,
  notes?: string,
) {
  return apiFetch('/api/mobile/check-in', {
    method: 'POST',
    body: JSON.stringify({
      device_id: deviceId,
      device_uid: deviceUid,
      action_type: action,
      lat,
      lng,
      notes,
    }),
  })
}

export async function createLocationShare(deviceId: string, durationMinutes: 15 | 30 | 60 | 360 | 1440) {
  const json = await apiFetch('/api/mobile/location-share', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, duration_minutes: durationMinutes }),
  })
  return json.data as { share_url: string; expires_at: string }
}
