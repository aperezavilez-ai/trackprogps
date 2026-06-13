'use client'

import { useMapStore } from '@/lib/stores/app-store'
import { Navigation, PauseCircle, WifiOff, Layers } from 'lucide-react'

type Filter = 'all' | 'online' | 'offline' | 'moving' | 'stopped'

const FILTERS: { key: Filter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all',     label: 'Todos',       icon: Layers },
  { key: 'moving',  label: 'En marcha',   icon: Navigation },
  { key: 'stopped', label: 'Detenidos',   icon: PauseCircle },
  { key: 'offline', label: 'Sin señal',   icon: WifiOff },
]

export function MapFilters() {
  const { filter, setFilter, vehicles } = useMapStore()
  const counts = {
    all:     vehicles.size,
    moving:  [...vehicles.values()].filter(v => v.speed > 2 && v.ignition).length,
    stopped: [...vehicles.values()].filter(v => v.speed <= 2 && v.ignition).length,
    offline: [...vehicles.values()].filter(v => !v.ignition).length,
    online:  [...vehicles.values()].filter(v => v.ignition).length,
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white rounded-xl shadow-md p-1 border border-gray-200">
      {FILTERS.map(f => (
        <button
          key={f.key}
          onClick={() => setFilter(f.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === f.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <f.icon className="w-3.5 h-3.5" />
          {f.label}
          {counts[f.key] > 0 && (
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
              {counts[f.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
