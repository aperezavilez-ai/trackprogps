import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator, Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTrackerStore } from '../../stores/tracker-store'
import { TRACKING_INTERVALS } from '../../lib/tracker/types'
import {
  requestTrackingPermissions, startBackgroundTracking, stopBackgroundTracking,
  getCurrentLocation, getPermissionStatus, getDeviceInfo, syncOfflineQueue,
} from '../../lib/tracker/background-location'
import { getStableDeviceUid, getPlatform } from '../../lib/tracker/device-id'
import {
  registerMobileDevice, sendTelemetry, sendSos, updateTrackerConfig, checkIn, createLocationShare,
} from '../../lib/tracker/api'
import { offlineQueueSize } from '../../lib/tracker/offline-queue'
import { registerForPushNotifications } from '../../lib/notifications'

export default function TrackerScreen() {
  const store = useTrackerStore()
  const [loading, setLoading] = useState(false)
  const [queueSize, setQueueSize] = useState(0)

  const refreshQueue = useCallback(async () => {
    setQueueSize(await offlineQueueSize())
  }, [])

  useEffect(() => { void refreshQueue() }, [refreshQueue, store.lastSync])

  async function setupTracker() {
    setLoading(true)
    try {
      const granted = await requestTrackingPermissions()
      if (!granted) {
        Alert.alert('Permisos', 'Se requiere ubicación en primer y segundo plano para rastreo.')
        return
      }
      const deviceUid = await getStableDeviceUid()
      const info = getDeviceInfo()
      const perms = await getPermissionStatus()
      const push = await registerForPushNotifications()

      const device = await registerMobileDevice({
        device_uid: deviceUid,
        platform: getPlatform(),
        brand: info.brand,
        model: info.model,
        os_version: info.os_version,
        app_version: info.app_version,
        push_token: push,
        permissions: perms,
      })

      store.setDevice(device, deviceUid)
      const firstPoint = await getCurrentLocation()
      if (firstPoint) {
        await sendTelemetry(device.device_id, deviceUid, [firstPoint])
        store.setLastSync(new Date().toISOString())
      }
      if (device.tracking_enabled) {
        await startBackgroundTracking(device.tracking_interval_sec)
      }
      const synced = await syncOfflineQueue(device.device_id, deviceUid)
      if (synced > 0) store.setLastSync(new Date().toISOString())
      await refreshQueue()
      Alert.alert('Listo', synced > 0 ? `Rastreo activo. ${synced} puntos sincronizados.` : 'Rastreo activo.')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo iniciar rastreo')
    } finally {
      setLoading(false)
    }
  }

  async function toggleTracking(enabled: boolean) {
    if (!store.deviceId || !store.deviceUid) return
    setLoading(true)
    try {
      await updateTrackerConfig(store.deviceId, store.deviceUid, { tracking_enabled: enabled })
      store.setTrackingEnabled(enabled)
      if (enabled) {
        const point = await getCurrentLocation()
        if (point) {
          await sendTelemetry(store.deviceId, store.deviceUid, [point])
          store.setLastSync(new Date().toISOString())
        }
        await startBackgroundTracking(store.trackingIntervalSec)
      } else {
        await stopBackgroundTracking()
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function changeInterval(sec: number) {
    if (!store.deviceId || !store.deviceUid) return
    setLoading(true)
    try {
      await updateTrackerConfig(store.deviceId, store.deviceUid, { tracking_interval_sec: sec })
      store.setTrackingInterval(sec)
      if (store.trackingEnabled) {
        await stopBackgroundTracking()
        await startBackgroundTracking(sec)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSos() {
    if (!store.deviceId || !store.deviceUid) {
      Alert.alert('SOS', 'Registra el dispositivo primero.')
      return
    }
    Alert.alert('Emergencia SOS', '¿Enviar alerta de emergencia con tu ubicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar SOS', style: 'destructive', onPress: async () => {
          try {
            const point = await getCurrentLocation()
            if (!point) throw new Error('Sin ubicación')
            await sendSos(store.deviceId!, store.deviceUid!, point.lat, point.lng, point.battery_pct)
            Alert.alert('SOS enviado', 'La alerta fue registrada en la plataforma.')
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar SOS')
          }
        },
      },
    ])
  }

  async function handleCheckIn(type: 'check_in' | 'check_out') {
    if (!store.deviceId || !store.deviceUid) return
    try {
      const point = await getCurrentLocation()
      await checkIn(store.deviceId, store.deviceUid, type, point?.lat, point?.lng)
      Alert.alert(type === 'check_in' ? 'Check-in' : 'Check-out', 'Registrado correctamente.')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error')
    }
  }

  async function handleShare() {
    if (!store.deviceId) return
    Alert.alert('Compartir ubicación', 'Selecciona duración', [
      { text: '15 min', onPress: () => void shareFor(15) },
      { text: '1 hora', onPress: () => void shareFor(60) },
      { text: '24 horas', onPress: () => void shareFor(1440) },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  async function shareFor(minutes: 15 | 30 | 60 | 360 | 1440) {
    if (!store.deviceId) return
    try {
      const data = await createLocationShare(store.deviceId, minutes)
      await Share.share({ message: `Mi ubicación TrackProGPS: ${data.share_url}`, url: data.share_url })
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="navigate-circle" size={28} color="#2563EB" />
          <View style={styles.flex1}>
            <Text style={styles.title}>Rastreo GPS móvil</Text>
            <Text style={styles.sub}>
              {store.deviceId ? 'Dispositivo registrado en TrackProGPS' : 'Registra este teléfono como rastreador'}
            </Text>
          </View>
        </View>

        {!store.deviceId ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void setupTracker()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Activar rastreo</Text>}
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Rastreo activo</Text>
              <Switch
                value={store.trackingEnabled}
                onValueChange={v => void toggleTracking(v)}
                disabled={loading}
              />
            </View>

            <Text style={styles.sectionLabel}>Intervalo de envío</Text>
            <View style={styles.chips}>
              {TRACKING_INTERVALS.map(sec => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.chip, store.trackingIntervalSec === sec && styles.chipActive]}
                  onPress={() => void changeInterval(sec)}
                >
                  <Text style={[styles.chipText, store.trackingIntervalSec === sec && styles.chipTextActive]}>
                    {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {store.lastSync && (
              <Text style={styles.meta}>Última sync: {new Date(store.lastSync).toLocaleString('es-MX')}</Text>
            )}
            {queueSize > 0 && (
              <Text style={styles.metaWarn}>{queueSize} puntos pendientes (offline)</Text>
            )}
            {store.lastError && <Text style={styles.error}>{store.lastError}</Text>}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.sosBtn} onPress={() => void handleSos()}>
        <Ionicons name="alert-circle" size={32} color="#fff" />
        <Text style={styles.sosText}>SOS — Emergencia</Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        <ActionBtn icon="enter-outline" label="Check-in" onPress={() => void handleCheckIn('check_in')} />
        <ActionBtn icon="exit-outline" label="Check-out" onPress={() => void handleCheckIn('check_out')} />
        <ActionBtn icon="share-social-outline" label="Compartir" onPress={() => void handleShare()} />
      </View>

      <Text style={styles.footer}>
        TrackProGPS Mobile — mismo login y plataforma que la web. Historial, geocercas y alertas integrados.
      </Text>
    </ScrollView>
  )
}

function ActionBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <Ionicons name={icon} size={22} color="#1E3A5F" />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  flex1: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  primaryBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '500', color: '#374151' },
  sectionLabel: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: '#2563EB' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  meta: { fontSize: 12, color: '#9CA3AF' },
  metaWarn: { fontSize: 12, color: '#D97706', marginTop: 4 },
  error: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  sosBtn: {
    backgroundColor: '#DC2626', borderRadius: 16, padding: 20, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16,
  },
  sosText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6,
  },
  actionLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  footer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
})
