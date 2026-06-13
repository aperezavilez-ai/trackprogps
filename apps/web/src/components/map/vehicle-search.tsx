'use client'

import { useState, useMemo } from 'react'
import { Search, X, Navigation, PauseCircle, WifiOff } from 'lucide-react'
import { useMapStore } from '@/lib/stores/app-store'

export function VehicleSearch() {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const { vehicles, setSelectedVehicle, setMapCenter, setMapZoom } = useMapStore()

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return [...vehicles.values()].filter(v =>
      (v.economicNum ?? '').toLowerCase().includes(q) ||
      (v.plates ?? '').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [query, vehicles])

  function selectVehicle(vehicleId: string, lat: number, lng: number) {
    setSelectedVehicle(vehicleId)
    setMapCenter({ lat, lng })
    setMapZoom(16)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="absolute top-4 right-4 z-10 w-64">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Buscar vehículo..."
          className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map(v => {
            const isMoving  = v.speed > 2 && v.ignition
            const isStopped = v.speed <= 2 && v.ignition
            return (
              <button
                key={v.vehicleId}
                onMouseDown={() => selectVehicle(v.vehicleId, v.lat, v.lng)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
              >
                {isMoving
                  ? <Navigation className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  : isStopped
                  ? <PauseCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                  : <WifiOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                <div>
                  <div className="text-sm font-medium text-gray-900">{v.economicNum}</div>
                  <div className="text-xs text-gray-500">{v.plates} · {Math.round(v.speed)} km/h</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
