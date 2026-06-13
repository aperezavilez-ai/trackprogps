import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

interface VehicleItem {
  id: string; economic_num: string; plates: string; brand: string; model: string; type: string
  driver: { full_name: string } | null
  position: {
    lat: number; lng: number; speed: number; ignition: boolean; recorded_at: string
  } | null
}

const VEHICLE_EMOJIS: Record<string, string> = {
  truck: '🚛', van: '🚐', bus: '🚌', motorcycle: '🏍️', pickup: '🛻', suv: '🚙', sedan: '🚗', other: '🚗',
}

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [filtered, setFiltered] = useState<VehicleItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'moving' | 'stopped' | 'offline'>('all')

  async function loadVehicles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('vehicles')
      .select('id, economic_num, plates, brand, model, type, driver:drivers(full_name), position:vehicle_positions(lat, lng, speed, ignition, recorded_at)')
      .eq('company_id', profile.company_id)
      .is('deleted_at', null)
      .order('economic_num')

    setVehicles(data as VehicleItem[] ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadVehicles() }, [])
  const onRefresh = async () => { setRefreshing(true); await loadVehicles(); setRefreshing(false) }

  useEffect(() => {
    const now = Date.now()
    const OFFLINE_MS = 5 * 60 * 1000
    let result = vehicles

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(v =>
        v.economic_num.toLowerCase().includes(q) ||
        v.plates.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q)
      )
    }

    if (filter !== 'all') {
      result = result.filter(v => {
        const p = Array.isArray(v.position) ? v.position[0] : v.position
        if (!p) return filter === 'offline'
        const isOld = now - new Date(p.recorded_at).getTime() > OFFLINE_MS
        if (filter === 'offline')  return isOld || !p.ignition
        if (filter === 'moving')   return !isOld && p.ignition && p.speed > 2
        if (filter === 'stopped')  return !isOld && p.ignition && p.speed <= 2
        return true
      })
    }

    setFiltered(result)
  }, [vehicles, search, filter])

  function getStatus(v: VehicleItem) {
    const now = Date.now()
    const p = Array.isArray(v.position) ? v.position[0] : v.position
    if (!p) return { label: 'Sin GPS', color: '#6B7280', dot: '#6B7280' }
    const isOld = now - new Date(p.recorded_at).getTime() > 5 * 60 * 1000
    if (isOld)        return { label: 'Sin señal',  color: '#6B7280', dot: '#6B7280' }
    if (!p.ignition)  return { label: 'Apagado',    color: '#6B7280', dot: '#6B7280' }
    if (p.speed > 2)  return { label: `${Math.round(p.speed)} km/h`, color: '#22C55E', dot: '#22C55E' }
    return               { label: 'Detenido',    color: '#EAB308', dot: '#EAB308' }
  }

  const renderVehicle = ({ item }: { item: VehicleItem }) => {
    const status = getStatus(item)
    const emoji  = VEHICLE_EMOJIS[item.type] ?? '🚗'
    const driver = item.driver as { full_name: string } | null

    return (
      <TouchableOpacity style={styles.vehicleCard} activeOpacity={0.7}>
        <View style={styles.vehicleIcon}>
          <Text style={styles.vehicleEmoji}>{emoji}</Text>
        </View>
        <View style={styles.vehicleInfo}>
          <View style={styles.vehicleHeader}>
            <Text style={styles.economicNum}>{item.economic_num}</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.vehicleModel}>{item.brand} {item.model} · {item.plates}</Text>
          <Text style={styles.driverText}>
            {driver ? `👤 ${driver.full_name}` : '👤 Sin conductor asignado'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
      </TouchableOpacity>
    )
  }

  const FILTER_OPTIONS: { key: typeof filter; label: string }[] = [
    { key: 'all',     label: 'Todos' },
    { key: 'moving',  label: 'En marcha' },
    { key: 'stopped', label: 'Detenido' },
    { key: 'offline', label: 'Sin señal' },
  ]

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por económico, placas..."
          placeholderTextColor="#9CA3AF"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(f => (
          <TouchableOpacity key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countBadge}>{filtered.length}</Text>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderVehicle}
        keyExtractor={v => v.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🚛</Text>
            <Text style={styles.emptyText}>No se encontraron vehículos</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchIcon:  {},
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  chipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  chipTextActive: { color: '#2563EB' },
  countBadge: { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' },

  list: { padding: 12, paddingTop: 4, gap: 8 },

  vehicleCard: {
    backgroundColor: '#fff', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  vehicleIcon: { width: 44, height: 44, backgroundColor: '#F3F4F6', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vehicleEmoji: { fontSize: 22 },
  vehicleInfo: { flex: 1 },
  vehicleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  economicNum: { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' },
  vehicleModel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  driverText: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText:  { fontSize: 14, color: '#9CA3AF' },
})
