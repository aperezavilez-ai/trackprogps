'use client'

import { useEffect } from 'react'
import { useMapStore } from '@/lib/stores/app-store'
import { Navigation, PauseCircle, WifiOff, Layers, AlertTriangle, TrendingUp, Smartphone, Truck, User } from 'lucide-react'

type Filter = 'all' | 'online' | 'offline' | 'moving' | 'stopped'

const FILTERS: { key: Filter; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all',     label: 'Todos',       short: 'Todos',   icon: Layers },
  { key: 'moving',  label: 'En marcha',   short: 'Marcha',  icon: Navigation },
  { key: 'stopped', label: 'Detenidos',   short: 'Parados', icon: PauseCircle },
  { key: 'offline', label: 'Sin señal',   short: 'Sin sig.', icon: WifiOff },
]

interface MapFiltersProps {
  activeAlerts: number
  productivity: number
}

export function MapFilters({ activeAlerts, productivity }: MapFiltersProps) {
  const {
    filter, setFilter, assetFilter, setAssetFilter, groupFilter, setGroupFilter,
    vehicles, vehicleGroups, setVehicleGroups,
  } = useMapStore()

  useEffect(() => {
    fetch('/api/vehicle-groups')
      .then(r => r.json())
      .then(json => setVehicleGroups(json.data ?? []))
      .catch(() => {})
  }, [setVehicleGroups])

  const visible = [...vehicles.values()].filter(v => {
    if (groupFilter !== 'all' && v.groupId !== groupFilter) return false
    if (assetFilter === 'mobile') return v.deviceSource === 'mobile'
    if (assetFilter === 'vehicles') return v.deviceSource !== 'mobile'
    if (assetFilter === 'personnel') return v.deviceSource === 'mobile' || v.vehicleType === 'other'
    return true
  })

  const counts = {
    all:     visible.length,
    moving:  visible.filter(v => v.speed > 2 && v.ignition).length,
    stopped: visible.filter(v => v.speed <= 2 && v.ignition).length,
    offline: visible.filter(v => !v.ignition).length,
    online:  visible.filter(v => v.ignition).length,
  }

  return (
    <div className="absolute top-2 left-2 right-2 lg:top-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-10 flex flex-col items-stretch lg:items-center gap-1.5 max-w-full pointer-events-none">
      {vehicleGroups.length > 1 && (
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          className="pointer-events-auto bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-auto"
        >
          <option value="all">Todos los grupos</option>
          {vehicleGroups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      )}

      <div className="overflow-x-auto no-scrollbar pointer-events-auto -mx-0.5 px-0.5">
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-md p-1 border border-gray-200 w-max min-w-0">
          {([
            { key: 'all' as const, label: 'Todos', icon: Layers },
            { key: 'vehicles' as const, label: 'Vehículos', icon: Truck },
            { key: 'mobile' as const, label: 'Móviles', icon: Smartphone },
            { key: 'personnel' as const, label: 'Personal', icon: User },
          ]).map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setAssetFilter(f.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                assetFilter === f.key ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <f.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar pointer-events-auto -mx-0.5 px-0.5">
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-md p-1 border border-gray-200 w-max min-w-0">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                filter === f.key ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <f.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{f.label}</span>
              <span className="sm:hidden">{f.short}</span>
              {counts[f.key] > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={() => { window.location.href = '/alerts' }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 transition whitespace-nowrap"
            title="Ver alertas activas"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Alertas</span>
            {activeAlerts > 0 && (
              <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold bg-red-100 text-red-700">
                {activeAlerts}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { window.location.href = '/reports' }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-50 transition whitespace-nowrap"
            title="Ver reportes de productividad"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Productividad</span>
            <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold bg-purple-100 text-purple-700">
              {productivity}%
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
