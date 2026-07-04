'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Gauge, MapPin, Zap, CheckCircle, Filter } from 'lucide-react'
import { useAlertsRealtime } from '@/lib/context/alerts-realtime-context'
import { usePermissions } from '@/lib/context/permissions-context'
import type { Alert } from '@gps-saas/types'

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-50 border-red-300 text-red-800',   dot: 'bg-red-500',    label: 'Crítica' },
  high:     { color: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-500', label: 'Alta' },
  medium:   { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', dot: 'bg-yellow-500', label: 'Media' },
  low:      { color: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-400',   label: 'Baja' },
}

const TYPE_LABELS: Record<string, string> = {
  speed_excess:          'Exceso de velocidad',
  geofence_enter:        'Entrada a geocerca',
  geofence_exit:         'Salida de geocerca',
  sos:                   'SOS / Emergencia',
  power_cut:             'Corte de corriente',
  unauthorized_movement: 'Movimiento no autorizado',
  ignition_on:           'Motor encendido',
  ignition_off:          'Motor apagado',
  signal_loss:           'Pérdida de señal',
  battery_low:           'Batería baja',
  maintenance_due:       'Mantenimiento pendiente',
  sim_balance_due:       'Recarga de chip',
  gps_disconnect:        'Desconexión GPS',
}

interface AlertWithVehicle extends Alert {
  vehicle: { economic_num: string; plates: string; brand: string; model: string } | null
}

export default function AlertsPage() {
  const { canAcknowledgeAlerts, companyId } = usePermissions()
  const [alerts, setAlerts]         = useState<AlertWithVehicle[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [filter, setFilter]         = useState({ severity: '', type: '', unackOnly: true })
  const [page, setPage]             = useState(1)

  const fetchAlerts = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), per_page: '50' })
    if (filter.severity) params.set('severity', filter.severity)
    if (filter.type)     params.set('type', filter.type)
    if (filter.unackOnly) params.set('unacknowledged', 'true')
    const res = await fetch(`/api/alerts?${params}`)
    const data = await res.json()
    setAlerts(data.data ?? [])
    setTotal(data.count ?? 0)
    setLoading(false)
  }, [filter])

  useEffect(() => { void fetchAlerts(page) }, [page, fetchAlerts])
  useAlertsRealtime((newAlert) => {
    setAlerts(prev => [newAlert as AlertWithVehicle, ...prev])
    setTotal(t => t + 1)
  })

  async function acknowledgeSelected() {
    if (!selected.size) return
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alert_ids: [...selected] }) })
    setSelected(new Set())
    void fetchAlerts(page)
  }

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Alertas</h1>
          <p className="text-sm text-gray-500 mt-1">{total} alertas {filter.unackOnly ? 'sin reconocer' : 'totales'}</p>
        </div>
        {canAcknowledgeAlerts && selected.size > 0 && (
          <button onClick={acknowledgeSelected}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Reconocer seleccionadas ({selected.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filter.unackOnly}
            onChange={e => setFilter(f => ({ ...f, unackOnly: e.target.checked }))}
            className="rounded" />
          Solo sin reconocer
        </label>
        <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">Toda severidad</option>
          {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Alerts list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Cargando alertas...</div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay alertas activas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {canAcknowledgeAlerts && (
            <div className="px-4 py-2 bg-gray-50 flex items-center gap-3">
              <input type="checkbox"
                checked={selected.size === alerts.length}
                onChange={e => setSelected(e.target.checked ? new Set(alerts.map(a => a.id)) : new Set())}
                className="rounded" />
              <span className="text-xs text-gray-500">Seleccionar todas</span>
            </div>
            )}

            {alerts.map(alert => {
              const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.low
              const isSelected = selected.has(alert.id)
              const isAck = !!alert.acknowledged_at
              return (
                <div key={alert.id} className={`flex items-start gap-4 px-4 py-4 transition ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'} ${isAck ? 'opacity-60' : ''}`}>
                  {canAcknowledgeAlerts && (
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(alert.id)}
                    className="rounded mt-1" />
                  )}
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{alert.title}</span>
                      {isAck && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Reconocida</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                      {alert.vehicle && <span className="font-medium text-gray-600">{alert.vehicle.economic_num} ({alert.vehicle.plates})</span>}
                      {alert.speed && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{alert.speed} km/h</span>}
                      {alert.lat && (
                        <a href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-orange-500 hover:underline">
                          <MapPin className="w-3 h-3" /> Ver ubicación
                        </a>
                      )}
                      <span>{new Date(alert.created_at).toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">Página {page}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  )
}
