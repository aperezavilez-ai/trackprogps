import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import * as Battery from 'expo-battery'
import * as Network from 'expo-network'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { TRACKING_TASK, type TelemetryPointPayload } from './types'
import { sendTelemetry } from './api'
import { drainOfflineQueue, enqueueOfflinePoints } from './offline-queue'
import { getStoredTrackerState, useTrackerStore } from '../../stores/tracker-store'

function inferActivity(speed: number): TelemetryPointPayload['activity'] {
  if (speed <= 1) return 'still'
  if (speed <= 6) return 'walking'
  if (speed <= 12) return 'running'
  if (speed <= 25) return 'cycling'
  if (speed <= 60) return 'motorcycle'
  if (speed > 60) return 'automotive'
  return 'unknown'
}

async function buildPoint(loc: Location.LocationObject): Promise<TelemetryPointPayload> {
  const [batteryLevel, batteryState, network] = await Promise.all([
    Battery.getBatteryLevelAsync().catch(() => -1),
    Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN),
    Network.getNetworkStateAsync().catch(() => ({ isConnected: true, type: Network.NetworkStateType.UNKNOWN })),
  ])

  const speedKmh = Math.max(0, (loc.coords.speed ?? 0) * 3.6)
  const heading = loc.coords.heading ?? 0

  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    speed: Math.round(speedKmh),
    heading: Math.round(heading >= 0 ? heading : 0),
    altitude: loc.coords.altitude,
    accuracy: loc.coords.accuracy,
    recorded_at: loc.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString(),
    battery_pct: batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null,
    battery_charging: batteryState === Battery.BatteryState.CHARGING,
    connection_type: network.type ?? null,
    gps_enabled: true,
    internet_available: network.isConnected ?? true,
    is_moving: speedKmh > 2,
    activity: inferActivity(speedKmh),
    mock_location: loc.mocked ?? false,
  }
}

TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[Tracker]', error.message)
    return
  }
  const locations = (data as { locations?: Location.LocationObject[] })?.locations
  if (!locations?.length) return

  const store = useTrackerStore.getState()
  const stored = store.deviceId && store.deviceUid ? store : await getStoredTrackerState()
  if (!stored?.deviceId || !stored.deviceUid || !stored.trackingEnabled) return

  const points = await Promise.all(locations.map(buildPoint))

  try {
    await sendTelemetry(stored.deviceId, stored.deviceUid, points)
    store.setLastSync(new Date().toISOString())
    store.setLastError(null)
  } catch (err) {
    await enqueueOfflinePoints(points)
    store.setLastError(err instanceof Error ? err.message : 'Error de sync')
  }
})

export async function requestTrackingPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') return false
  const bg = await Location.requestBackgroundPermissionsAsync()
  return bg.status === 'granted'
}

export async function getPermissionStatus(): Promise<Record<string, boolean>> {
  const fg = await Location.getForegroundPermissionsAsync()
  const bg = await Location.getBackgroundPermissionsAsync()
  return {
    foreground_location: fg.status === 'granted',
    background_location: bg.status === 'granted',
  }
}

export async function startBackgroundTracking(intervalSec: number): Promise<void> {
  const hasTask = await TaskManager.isTaskRegisteredAsync(TRACKING_TASK)
  if (hasTask) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK)
  }

  const distanceInterval = Platform.OS === 'ios'
    ? (intervalSec <= 10 ? 0 : 1)
    : (intervalSec <= 10 ? 5 : 15)

  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: intervalSec * 1000,
    distanceInterval,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: intervalSec * 1000,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: Platform.OS === 'android' ? {
      notificationTitle: 'TrackProGPS',
      notificationBody: 'Rastreo activo en segundo plano',
      notificationColor: '#2563EB',
      killServiceOnDestroy: false,
    } : undefined,
    pausesUpdatesAutomatically: false,
  })
}

export async function stopBackgroundTracking(): Promise<void> {
  const hasTask = await TaskManager.isTaskRegisteredAsync(TRACKING_TASK)
  if (hasTask) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK)
  }
}

export async function getCurrentLocation(): Promise<TelemetryPointPayload | null> {
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
  return buildPoint(loc)
}

export function getDeviceInfo() {
  return {
    brand: Constants.deviceName ?? null,
    model: Constants.platform?.ios?.model ?? Constants.deviceName ?? null,
    os_version: String(Platform.Version),
    app_version: Constants.expoConfig?.version ?? '1.0.0',
  }
}

export async function syncOfflineQueue(deviceId: string, deviceUid: string): Promise<number> {
  const points = await drainOfflineQueue()
  if (!points.length) return 0
  const batchSize = 50
  for (let i = 0; i < points.length; i += batchSize) {
    await sendTelemetry(deviceId, deviceUid, points.slice(i, i + batchSize))
  }
  return points.length
}
