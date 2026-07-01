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

type ActiveMobileTracking = {
  deviceId?: string
  deviceUid: string
  intervalSec: number
  updated_at: string
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

  const position = await requestLocation().then(pos => {
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

  if (registered && telemetrySent) {
    await startBrowserMobileTelemetry({
      deviceId: resolvedDeviceId,
      deviceUid,
      intervalSec: trackingIntervalSec,
    }, {
      initialPosition: position ?? undefined,
    })
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
    const stored = localStorage.getItem(ACTIVE_TRACKING_KEY)
    if (!stored) return
    const parsed = JSON.parse(stored) as ActiveMobileTracking
    if (!parsed.deviceId && !parsed.deviceUid) return
    void startBrowserMobileTelemetry(parsed, { auto: true })
  } catch {
    localStorage.removeItem(ACTIVE_TRACKING_KEY)
  }
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
        maximumAge: Math.max(15_000, intervalSec * 1000),
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

    if (latestPosition) {
      void sendPosition(latestPosition, new Date().toISOString())
      return
    }

    if (currentPermission === 'prompt') return

    requestLocation()
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
  localStorage.removeItem(ACTIVE_TRACKING_KEY)
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

function requestLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation unsupported'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
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
