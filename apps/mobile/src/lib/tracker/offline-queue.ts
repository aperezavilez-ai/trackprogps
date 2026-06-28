import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TelemetryPointPayload } from './types'

const QUEUE_KEY = 'trackpro_offline_queue'

export async function enqueueOfflinePoints(points: TelemetryPointPayload[]): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  const queue: TelemetryPointPayload[] = raw ? JSON.parse(raw) : []
  queue.push(...points)
  const trimmed = queue.slice(-500)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed))
}

export async function drainOfflineQueue(): Promise<TelemetryPointPayload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return []
  await AsyncStorage.removeItem(QUEUE_KEY)
  return JSON.parse(raw) as TelemetryPointPayload[]
}

export async function offlineQueueSize(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return 0
  return (JSON.parse(raw) as TelemetryPointPayload[]).length
}
