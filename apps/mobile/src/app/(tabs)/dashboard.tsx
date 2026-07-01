import { useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { canViewReports } from '../../lib/auth-helpers'
import { useAuthStore } from '../../stores/auth-store'

interface Stats {
  total: number; moving: number; stopped: number; offline: number; alerts: number
}

interface Alert {
  id: string; title: string; type: string; severity: string; created_at: string
  vehicle: { economic_num: string } | null
}

type AlertRow = Omit<Alert, 'vehicle'> & {
  vehicle: { economic_num: string } | { economic_num: string }[] | null
}

export default function DashboardScreen() {
  const profile = useAuthStore(s => s.profile)
  const showReports = profile ? canViewReports(profile.role) : true
  const [stats, setStats]       = useState<Stats>({ total: 0, moving: 0, stopped: 0, offline: 0, alerts: 0 })
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [companyName, setCompanyName] = useState('')

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('users')
      .select('company_id, company:companies(name)').eq('id', user.id).single()
    if (!profile) return

    const company = Array.isArray(profile.company) ? profile.company[0] : profile.company
    setCompanyName(company?.name ?? '')

    const now = Date.now()
    const OFFLINE_MS = 5 * 60 * 1000

    const [{ data: positions }, { data: alerts }] = await Promise.all([
      supabase.from('vehicle_positions').select('ignition, speed, recorded_at').eq('company_id', profile.company_id),
      supabase.from('alerts').select('id, title, type, severity, created_at, vehicle:vehicles(economic_num)')
        .eq('company_id', profile.company_id).is('acknowledged_at', null)
        .order('created_at', { ascending: false }).limit(5),
    ])

    let moving = 0, stopped = 0, offline = 0
    for (const p of positions ?? []) {
      const isOld = now - new Date(p.recorded_at).getTime() > OFFLINE_MS
      if (isOld || !p.ignition) offline++
      else if (p.speed > 2) moving++
      else stopped++
    }

    const normalizedAlerts = ((alerts ?? []) as AlertRow[]).map(alert => ({
      ...alert,
      vehicle: Array.isArray(alert.vehicle) ? alert.vehicle[0] ?? null : alert.vehicle,
    }))

    setStats({ total: positions?.length ?? 0, moving, stopped, offline, alerts: normalizedAlerts.length })
    setRecentAlerts(normalizedAlerts)
  }

  useEffect(() => { void loadData() }, [])
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const SEVERITY_COLORS: Record<string, string> = {
    critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#3B82F6',
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Bienvenido</Text>
        <Text style={styles.companyName}>{companyName}</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Total',       value: stats.total,   color: '#3B82F6', icon: 'car',         bg: '#EFF6FF' },
          { label: 'Movimiento',  value: stats.moving,  color: '#22C55E', icon: 'navigate',    bg: '#F0FDF4' },
          { label: 'Detenido',    value: stats.stopped, color: '#EAB308', icon: 'pause-circle', bg: '#FEFCE8' },
          { label: 'Sin señal',   value: stats.offline, color: '#6B7280', icon: 'wifi',        bg: '#F9FAFB' },
          { label: 'Alertas',     value: stats.alerts,  color: '#EF4444', icon: 'warning',     bg: '#FEF2F2' },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: 'Ver mapa',   icon: 'map',           route: '/(tabs)/map' },
            { label: 'Alertas',    icon: 'notifications',  route: '/(tabs)/alerts' },
            { label: 'Mi flota',   icon: 'car-sport',     route: '/(tabs)/vehicles' },
            ...(showReports ? [{ label: 'Reportes', icon: 'bar-chart', route: '/reports' }] : []),
          ].map(a => (
            <TouchableOpacity key={a.label} style={styles.actionButton} onPress={() => router.push(a.route as never)}>
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={22} color="#2563EB" />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent alerts */}
      {recentAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alertas recientes</Text>
          <View style={styles.alertsList}>
            {recentAlerts.map(alert => (
              <View key={alert.id} style={styles.alertItem}>
                <View style={[styles.alertDot, { backgroundColor: SEVERITY_COLORS[alert.severity] ?? '#6B7280' }]} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertSub}>
                    {alert.vehicle?.economic_num ?? ''} · {new Date(alert.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#1E3A5F', padding: 20, paddingTop: 16 },
  greeting:    { fontSize: 13, color: '#93C5FD' },
  companyName: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  statCard: {
    flex: 1, minWidth: '28%', borderRadius: 12, padding: 12,
    alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },

  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },

  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  actionIcon: { width: 44, height: 44, backgroundColor: '#EFF6FF', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },

  alertsList: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  alertItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  alertDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  alertSub:   { fontSize: 11, color: '#6B7280', marginTop: 1 },
})
