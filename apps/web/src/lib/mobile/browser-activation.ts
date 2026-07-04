'use client'

import { getInstallPlatform } from '@/lib/pwa/detect-platform'

type BrowserPermissionName = 'location' | 'camera' | 'microphone' | 'notifications'

export type BrowserPermissionMap = Record<BrowserPermissionName, boolean>

export type BrowserActivationResult = {
  deviceId?: string
  deviceUid: string
  permissions: BrowserPermissionMap
  position: GeolocationPosition | null
  registered: boolean
  telemetrySent: boolean
  needsLogin: boolean
}

const DEVICE_UID_KEY = 'trackpro_mobile_device_uid'
const ACTIVE_TRACKING_KEY = 'trackpro_mobile_tracking_active'
const FRESH_LOCATION_MAX_AGE_MS = 5_000

type ActiveMobileTracking = {
  deviceId?: string
  deviceUid: string
  intervalSec: number
  updated_at: string
  last_resume_at?: string
}

declare global {
  interface Window {
    __trackproMobileTelemetryTimer?: number
    __trackproMobileTelemetryWatchId?: number
  }
}

export function getOrCreateMobileDeviceUid(preferredUid?: string): string {
  if (preferredUid) {
    localStorage.setItem(DEVICE_UID_KEY, preferredUid)
    return preferredUid
  }

  const existing = localStorage.getItem(DEVICE_UID_KEY)
  if (existing) return existing

  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const uid = `WEB-${id}`.slice(0, 64)
  localStorage.setItem(DEVICE_UID_KEY, uid)
  return uid
}

export function isMobileBrowserPlatform(): boolean {
  const platform = getInstallPlatform()
  return platform === 'ios' || platform === 'android'
}

export function getMobileRegisterPlatform(): 'android' | 'ios' {
  return getInstallPlatform() === 'ios' ? 'ios' : 'android'
}

export async function activateBrowserMobileTracking(options: {
  deviceId?: string
  deviceUid?: string
} = {}): Promise<BrowserActivationResult> {
  const deviceUid = getOrCreateMobileDeviceUid(options.deviceUid)
  const permissions: BrowserPermissionMap = {
    location: false,
    camera: false,
    microphone: false,
    notifications: false,
  }

  const position = await requestLocation({ maximumAge: FRESH_LOCATION_MAX_AGE_MS }).then(pos => {
    permissions.location = true
    return pos
  }).catch(() => null)

  permissions.camera = await requestMediaPermission({ video: true })
  permissions.microphone = await requestMediaPermission({ audio: true })
  permissions.notifications = await requestNotificationPermission()

  let needsLogin = false
  let registered = Boolean(options.deviceId)
  let resolvedDeviceId = options.deviceId
  let trackingIntervalSec = 30
  if (!options.deviceId) {
    const registerRes = await fetch('/api/mobile/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_uid: deviceUid,
        platform: getMobileRegisterPlatform(),
        model: getFriendlyDeviceModel(),
        os_version: navigator.userAgent.slice(0, 30),
        app_version: 'web-pwa',
        permissions,
      }),
    })

    needsLogin = registerRes.status === 401
    registered = registerRes.ok
    if (registerRes.ok) {
      const json = await registerRes.json().catch(() => null) as {
        data?: { device_id?: string; tracking_interval_sec?: number }
      } | null
      resolvedDeviceId = json?.data?.device_id
      trackingIntervalSec = json?.data?.tracking_interval_sec ?? trackingIntervalSec
    }
  } else {
    const configRes = await fetch('/api/mobile/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: options.deviceId,
        config: { tracking_enabled: true },
      }),
    })
    needsLogin = configRes.status === 401
    registered = configRes.ok
    if (configRes.ok) {
      const json = await configRes.json().catch(() => null) as {
        data?: { tracking_interval_sec?: number }
      } | null
      trackingIntervalSec = json?.data?.tracking_interval_sec ?? trackingIntervalSec
    }
  }

  let telemetrySent = false
  if (registered && position) {
    telemetrySent = await sendMobileTelemetryPoint(position, {
      deviceId: resolvedDeviceId,
      deviceUid,
    }).then(result => {
      trackingIntervalSec = result.trackingIntervalSec ?? trackingIntervalSec
      return result.ok
    })
  }

  localStorage.setItem('trackpro_mobile_permissions', JSON.stringify({
    permissions,
    updated_at: new Date().toISOString(),
    registered,
    telemetrySent,
  }))

  if (registered) {
    await startBrowserMobileTelemetry({
      deviceId: resolvedDeviceId,
      deviceUid,
      intervalSec: trackingIntervalSec,
    }, {
      initialPosition: position ?? undefined,
    }).catch(() => {})
  }

  return {
    deviceId: resolvedDeviceId,
    deviceUid,
    permissions,
    position,
    registered,
    telemetrySent,
    needsLogin,
  }
}

export function resumeBrowserMobileTelemetry() {
  if (typeof window === 'undefined') return
  if (!isMobileBrowserPlatform()) return

  try {
    const parsed = getStoredActiveTracking()
    if (!parsed.deviceId && !parsed.deviceUid) return
    void startBrowserMobileTelemetry(parsed, { auto: true })
  } catch {
    // Keep the authorization on transient storage parse issues; a manual re-activation can repair it.
  }
}

function getStoredActiveTracking(): ActiveMobileTracking {
  const stored = localStorage.getItem(ACTIVE_TRACKING_KEY)
  if (stored) return JSON.parse(stored) as ActiveMobileTracking

  const deviceUid = localStorage.getItem(DEVICE_UID_KEY) ?? getOrCreateMobileDeviceUid()
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key?.startsWith('trackpro_mobile_activation:')) continue
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as { registered?: boolean } | null
    if (!value?.registered) continue
    if (key.startsWith('trackpro_mobile_activation:device:')) {
      return {
        deviceId: key.replace('trackpro_mobile_activation:device:', ''),
        deviceUid,
        intervalSec: 30,
        updated_at: new Date().toISOString(),
      }
    }
    if (key.startsWith('trackpro_mobile_activation:uid:')) {
      return {
        deviceUid: key.replace('trackpro_mobile_activation:uid:', ''),
        intervalSec: 30,
        updated_at: new Date().toISOString(),
      }
    }
  }

  const legacy = JSON.parse(localStorage.getItem('trackpro_mobile_permissions') ?? 'null') as { registered?: boolean } | null
  if (legacy?.registered) {
    return { deviceUid, intervalSec: 30, updated_at: new Date().toISOString() }
  }

  return { deviceUid: '', intervalSec: 30, updated_at: new Date().toISOString() }
}

async function startBrowserMobileTelemetry(input: {
  deviceId?: string
  deviceUid: string
  intervalSec?: number
}, options: { auto?: boolean; initialPosition?: GeolocationPosition } = {}) {
  if (typeof window === 'undefined') return
  if (!isMobileBrowserPlatform()) return

  const permission = await getLocationPermissionState()
  if (options.auto && permission === 'prompt') return
  if (permission === 'denied') {
    stopBrowserMobileTelemetry()
    return
  }

  const intervalSec = Math.max(input.intervalSec ?? 30, 5)
  const active: ActiveMobileTracking = {
    deviceId: input.deviceId,
    deviceUid: input.deviceUid,
    intervalSec,
    updated_at: new Date().toISOString(),
    last_resume_at: options.auto ? new Date().toISOString() : undefined,
  }
  localStorage.setItem(ACTIVE_TRACKING_KEY, JSON.stringify(active))

  if (window.__trackproMobileTelemetryTimer) {
    window.clearInterval(window.__trackproMobileTelemetryTimer)
    window.__trackproMobileTelemetryTimer = undefined
  }
  if (window.__trackproMobileTelemetryWatchId != null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(window.__trackproMobileTelemetryWatchId)
    window.__trackproMobileTelemetryWatchId = undefined
  }

  let latestPosition = options.initialPosition
  let lastSentAt = latestPosition ? Date.now() : 0
  let sending = false

  const sendPosition = async (position: GeolocationPosition, recordedAt = new Date(position.timestamp).toISOString()) => {
    if (sending) return
    sending = true
    const result = await sendMobileTelemetryPoint(position, input, recordedAt)
      .catch((): { ok: boolean; trackingIntervalSec?: number } => ({ ok: false }))
    sending = false
    lastSentAt = Date.now()

    if (result.ok && result.trackingIntervalSec && result.trackingIntervalSec !== intervalSec) {
      await startBrowserMobileTelemetry(
        { ...input, intervalSec: result.trackingIntervalSec },
        { ...options, initialPosition: position },
      )
    }
  }

  if (!latestPosition && permission !== 'prompt') {
    requestLocation({ maximumAge: FRESH_LOCATION_MAX_AGE_MS })
      .then((position) => {
        latestPosition = position
        void sendPosition(position)
      })
      .catch(() => {})
  }

  if ('geolocation' in navigator && navigator.geolocation.watchPosition) {
    window.__trackproMobileTelemetryWatchId = navigator.geolocation.watchPosition(
      (position) => {
        latestPosition = position
        if (Date.now() - lastSentAt >= intervalSec * 1000) {
          void sendPosition(position)
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) stopBrowserMobileTelemetry()
      },
      {
        enableHighAccuracy: true,
        maximumAge: FRESH_LOCATION_MAX_AGE_MS,
        timeout: 30_000,
      },
    )
  }

  window.__trackproMobileTelemetryTimer = window.setInterval(async () => {
    const currentPermission = await getLocationPermissionState()
    if (currentPermission === 'denied') {
      stopBrowserMobileTelemetry()
      return
    }

    if (currentPermission === 'prompt') return

    requestLocation({ maximumAge: 0, timeout: 30_000 })
      .then((position) => {
        latestPosition = position
        void sendPosition(position)
      })
      .catch(() => {})
  }, intervalSec * 1000)
}

function stopBrowserMobileTelemetry() {
  if (typeof window === 'undefined') return
  if (window.__trackproMobileTelemetryTimer) {
    window.clearInterval(window.__trackproMobileTelemetryTimer)
    window.__trackproMobileTelemetryTimer = undefined
  }
  if (window.__trackproMobileTelemetryWatchId != null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(window.__trackproMobileTelemetryWatchId)
    window.__trackproMobileTelemetryWatchId = undefined
  }
}

async function getLocationPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return null
  }
}

async function sendMobileTelemetryPoint(
  position: GeolocationPosition,
  ids: { deviceId?: string; deviceUid: string },
  recordedAt = new Date(position.timestamp).toISOString(),
): Promise<{ ok: boolean; trackingIntervalSec?: number }> {
  const battery = await getBrowserBattery()
  const telemetryRes = await fetch('/api/mobile/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(ids.deviceId ? { device_id: ids.deviceId } : { device_uid: ids.deviceUid }),
      points: [{
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed ?? 0,
        heading: position.coords.heading ?? 0,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        recorded_at: recordedAt,
        gps_enabled: true,
        internet_available: navigator.onLine,
        connection_type: getConnectionType(),
        battery_pct: battery?.pct ?? null,
        battery_charging: battery?.charging ?? null,
        activity: 'unknown',
        is_moving: false,
        mock_location: false,
      }],
    }),
  })

  if (!telemetryRes.ok) return { ok: false }
  const json = await telemetryRes.json().catch(() => null) as {
    data?: { tracking_interval_sec?: number }
  } | null
  return {
    ok: true,
    trackingIntervalSec: json?.data?.tracking_interval_sec,
  }
}

function requestLocation(options: PositionOptions = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation unsupported'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: options.timeout ?? 15_000,
      maximumAge: options.maximumAge ?? FRESH_LOCATION_MAX_AGE_MS,
    })
  })
}

async function requestMediaPermission(constraints: MediaStreamConstraints): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch {
    return false
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

function getFriendlyDeviceModel(): string {
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'TrackProGPS iPhone'
  if (/iPad/i.test(ua)) return 'TrackProGPS iPad'
  if (/Android/i.test(ua)) return 'TrackProGPS Android'
  return 'TrackProGPS Mobile'
}

function getConnectionType(): string | null {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string }
  }).connection

  return connection?.type ?? connection?.effectiveType ?? null
}

async function getBrowserBattery(): Promise<{ pct: number; charging: boolean | null } | null> {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level?: number; charging?: boolean }>
  }
  if (typeof nav.getBattery !== 'function') return null
  try {
    const battery = await nav.getBattery()
    if (typeof battery.level !== 'number') return null
    return {
      pct: Math.max(0, Math.min(100, Math.round(battery.level * 100))),
      charging: typeof battery.charging === 'boolean' ? battery.charging : null,
    }
  } catch {
    return null
  }
}
