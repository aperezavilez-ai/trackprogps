import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapView, { Marker, Callout, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

interface VehiclePosition {
  vehicle_id: string; lat: number; lng: number; speed: number
  heading: number; ignition: boolean; recorded_at: string
  vehicle: { economic_num: string; plates: string; driver: { full_name: string } | null } | null
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null)
  const [positions, setPositions]   = useState<VehiclePosition[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<string | null>(null)
  const [companyId, setCompanyId]   = useState('')

  async function loadPositions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
    if (!profile) return
    setCompanyId(profile.company_id)

    const { data } = await supabase
      .from('vehicle_positions')
      .select('*, vehicle:vehicles(economic_num, plates, driver:drivers(full_name))')
      .eq('company_id', profile.company_id)

    setPositions(data as VehiclePosition[] ?? [])
    setLoading(false)

    // Fit map to all vehicles
    if (data?.length && mapRef.current) {
      const coords = (data as VehiclePosition[]).map(p => ({ latitude: p.lat, longitude: p.lng }))
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
        animated: true,
      })
    }
  }

  useEffect(() => {
    void loadPositions()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('mobile-positions')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'vehicle_positions',
      }, (payload) => {
        const updated = payload.new as VehiclePosition
        setPositions(prev => {
          const existing = prev.findIndex(p => p.vehicle_id === updated.vehicle_id)
          if (existing >= 0) {
            const next = [...prev]
            next[existing] = { ...next[existing]!, ...updated }
            return next
          }
          return [...prev, updated]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function getMarkerColor(p: VehiclePosition): string {
    const isOld = Date.now() - new Date(p.recorded_at).getTime() > 5 * 60 * 1000
    if (isOld)       return '#6B7280' // gray - no signal
    if (!p.ignition) return '#6B7280' // gray - off
    if (p.speed > 2) return '#22C55E' // green - moving
    return '#EAB308'                  // yellow - stopped+on
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando vehículos...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{ latitude: 19.4326, longitude: -99.1332, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
      >
        {positions.map(p => {
          const v = p.vehicle as { economic_num: string; plates: string; driver: { full_name: string } | null } | null
          const color = getMarkerColor(p)

          return (
            <Marker
              key={p.vehicle_id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              rotation={p.heading}
              onPress={() => setSelected(p.vehicle_id === selected ? null : p.vehicle_id)}
            >
              <View style={[styles.markerContainer, { borderColor: color }]}>
                <View style={[styles.markerDot, { backgroundColor: color }]} />
              </View>

              {selected === p.vehicle_id && (
                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{v?.economic_num ?? 'Vehículo'}</Text>
                    <Text style={styles.calloutPlates}>{v?.plates ?? ''}</Text>
                    <Text style={styles.calloutInfo}>
                      {p.ignition ? (p.speed > 2 ? `🟢 ${Math.round(p.speed)} km/h` : '🟡 Detenido') : '⚫ Apagado'}
                    </Text>
                    {v?.driver && <Text style={styles.calloutDriver}>👤 {v.driver.full_name}</Text>}
                    <Text style={styles.calloutTime}>
                      🕐 {new Date(p.recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </Callout>
              )}
            </Marker>
          )
        })}
      </MapView>

      {/* Controls overlay */}
      <View style={styles.overlay}>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{positions.length} vehículos</Text>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadPositions}>
          <Ionicons name="refresh" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 14 },

  markerContainer: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerDot: { width: 14, height: 14, borderRadius: 7 },

  callout: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, minWidth: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  calloutTitle:  { fontSize: 15, fontWeight: '700', color: '#111827' },
  calloutPlates: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  calloutInfo:   { fontSize: 13, marginTop: 6, color: '#374151' },
  calloutDriver: { fontSize: 12, color: '#374151', marginTop: 3 },
  calloutTime:   { fontSize: 11, color: '#9CA3AF', marginTop: 3 },

  overlay: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  countBadge: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  countText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  refreshButton: {
    backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
})
