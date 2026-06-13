import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert as RNAlert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

interface AlertItem {
  id: string; type: string; severity: string; title: string
  message: string; speed: number | null; lat: number | null; lng: number | null
  created_at: string; acknowledged_at: string | null
  vehicle: { economic_num: string; plates: string } | null
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  critical: { color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle' },
  high:     { color: '#F97316', bg: '#FFF7ED', icon: 'warning' },
  medium:   { color: '#EAB308', bg: '#FEFCE8', icon: 'information-circle' },
  low:      { color: '#3B82F6', bg: '#EFF6FF', icon: 'information-circle' },
}

export default function AlertsScreen() {
  const [alerts, setAlerts]     = useState<AlertItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [unackOnly, setUnackOnly] = useState(true)

  async function loadAlerts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
    if (!profile) return
    setCompanyId(profile.company_id)

    let query = supabase
      .from('alerts')
      .select('*, vehicle:vehicles(economic_num, plates)')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (unackOnly) query = query.is('acknowledged_at', null)

    const { data } = await query
    setAlerts(data as AlertItem[] ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadAlerts() }, [unackOnly])

  // Realtime new alerts
  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel('mobile-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alerts',
        filter: `company_id=eq.${companyId}`,
      }, (payload) => {
        setAlerts(prev => [payload.new as AlertItem, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId])

  const onRefresh = async () => { setRefreshing(true); await loadAlerts(); setRefreshing(false) }

  async function acknowledge(alertId: string) {
    await supabase.from('alerts').update({ acknowledged_at: new Date().toISOString() }).eq('id', alertId)
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged_at: new Date().toISOString() } : a))
  }

  function confirmAck(alert: AlertItem) {
    RNAlert.alert('Reconocer alerta', `¿Reconocer "${alert.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reconocer', onPress: () => acknowledge(alert.id) },
    ])
  }

  const renderAlert = ({ item }: { item: AlertItem }) => {
    const cfg = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG['low']!
    const isAck = !!item.acknowledged_at
    const timeAgo = () => {
      const s = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 1000)
      if (s < 60) return `${s}s`
      if (s < 3600) return `${Math.floor(s / 60)}min`
      return `${Math.floor(s / 3600)}h`
    }

    return (
      <View style={[styles.alertCard, { borderLeftColor: cfg.color, opacity: isAck ? 0.6 : 1 }]}>
        <View style={[styles.alertIconContainer, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={20} color={cfg.color} />
        </View>
        <View style={styles.alertBody}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.alertTime}>{timeAgo()}</Text>
          </View>
          <Text style={styles.alertMessage} numberOfLines={2}>{item.message}</Text>
          <View style={styles.alertMeta}>
            {item.vehicle && (
              <View style={styles.metaTag}>
                <Ionicons name="car-outline" size={11} color="#6B7280" />
                <Text style={styles.metaText}>{item.vehicle.economic_num}</Text>
              </View>
            )}
            {item.speed && (
              <View style={styles.metaTag}>
                <Ionicons name="speedometer-outline" size={11} color="#6B7280" />
                <Text style={styles.metaText}>{Math.round(item.speed)} km/h</Text>
              </View>
            )}
            {item.lat && (
              <View style={styles.metaTag}>
                <Ionicons name="location-outline" size={11} color="#3B82F6" />
                <Text style={[styles.metaText, { color: '#3B82F6' }]}>Ver mapa</Text>
              </View>
            )}
          </View>
        </View>
        {!isAck && (
          <TouchableOpacity style={styles.ackButton} onPress={() => confirmAck(item)}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#22C55E" />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, unackOnly && styles.filterChipActive]}
          onPress={() => setUnackOnly(true)}
        >
          <Text style={[styles.filterChipText, unackOnly && styles.filterChipTextActive]}>Sin reconocer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, !unackOnly && styles.filterChipActive]}
          onPress={() => setUnackOnly(false)}
        >
          <Text style={[styles.filterChipText, !unackOnly && styles.filterChipTextActive]}>Todas</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.countText}>{alerts.length} alertas</Text>
      </View>

      <FlatList
        data={alerts}
        renderItem={renderAlert}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text style={styles.emptyTitle}>Sin alertas</Text>
            <Text style={styles.emptyText}>No hay alertas {unackOnly ? 'sin reconocer' : 'registradas'}</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  filterChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterChipTextActive: { color: '#2563EB' },
  countText: { fontSize: 12, color: '#9CA3AF' },

  list: { padding: 12, gap: 8 },

  alertCard: {
    backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4,
    flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  alertIconContainer: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alertBody: { flex: 1 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#111827', flex: 1 },
  alertTime:  { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },
  alertMessage: { fontSize: 12, color: '#4B5563', marginTop: 3, lineHeight: 17 },
  alertMeta:  { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  metaTag:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:   { fontSize: 11, color: '#6B7280' },
  ackButton:  { padding: 4 },

  emptyState: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyText:  { fontSize: 13, color: '#9CA3AF' },
})
