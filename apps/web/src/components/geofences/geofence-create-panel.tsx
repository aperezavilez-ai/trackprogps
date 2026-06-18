'use client'

import { useState, useEffect } from 'react'
import { Loader2, RotateCcw, Save, X, Circle, Hexagon } from 'lucide-react'
import type { DrawType } from './geofence-draw-layer'

interface VehicleOption {
  id: string
  economic_num: string
  plates: string
  group?: { name: string; color: string } | null
}

export interface GeofenceCreateDraft {
  name: string
  type: DrawType
  color: string
  radius_m: number
  alert_on_enter: boolean
  alert_on_exit: boolean
  vehicleScope: 'all' | 'selected'
  selectedVehicleIds: string[]
}

interface Props {
  draft: GeofenceCreateDraft
  onChange: (patch: Partial<GeofenceCreateDraft>) => void
  onReset: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  error: string
  canSave: boolean
  hint: string
  pointCount: number
}

export function GeofenceCreatePanel({
  draft,
  onChange,
  onReset,
  onCancel,
  onSave,
  saving,
  error,
  canSave,
  hint,
  pointCount,
}: Props) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [vehicleSearch, setVehicleSearch] = useState('')

  useEffect(() => {
    fetch('/api/vehicles?per_page=200')
      .then(r => r.json())
      .then(d => setVehicles(d.data ?? []))
      .catch(() => {})
  }, [])

  const filteredVehicles = vehicles.filter(v => {
    const q = vehicleSearch.toLowerCase()
    if (!q) return true
    return v.economic_num.toLowerCase().includes(q) || v.plates.toLowerCase().includes(q)
  })

  function toggleVehicle(id: string) {
    const next = draft.selectedVehicleIds.includes(id)
      ? draft.selectedVehicleIds.filter(v => v !== id)
      : [...draft.selectedVehicleIds, id]
    onChange({ selectedVehicleIds: next })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col max-h-[55vh] lg:max-h-none overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Nueva geocerca</h2>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Cancelar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ type: 'circular' })}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition ${
              draft.type === 'circular'
                ? 'bg-orange-50 border-orange-300 text-orange-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Circle className="w-4 h-4" />
            Circular
          </button>
          <button
            type="button"
            onClick={() => onChange({ type: 'polygon' })}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition ${
              draft.type === 'polygon'
                ? 'bg-orange-50 border-orange-300 text-orange-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Hexagon className="w-4 h-4" />
            Polígono
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
          <input
            required
            value={draft.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="Bodega Central"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          {draft.type === 'circular' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Radio: {draft.radius_m.toLocaleString()} m
              </label>
              <input
                type="range"
                min={50}
                max={50000}
                step={50}
                value={draft.radius_m}
                onChange={e => onChange({ radius_m: parseInt(e.target.value, 10) })}
                className="w-full"
              />
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{pointCount}</span> punto(s) — mínimo 3
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color</label>
            <input
              type="color"
              value={draft.color}
              onChange={e => onChange({ color: e.target.value })}
              className="w-12 h-10 border border-gray-300 rounded-xl cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            ['alert_on_enter', 'Alertar entrada'],
            ['alert_on_exit', 'Alertar salida'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm">
              <input
                type="checkbox"
                checked={draft[key as keyof GeofenceCreateDraft] as boolean}
                onChange={e => onChange({ [key]: e.target.checked } as Partial<GeofenceCreateDraft>)}
                className="rounded"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <label className="block text-sm font-medium text-gray-700">Aplicar a</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ vehicleScope: 'all' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                draft.vehicleScope === 'all' ? 'bg-orange-50 border-orange-300 text-orange-600' : 'border-gray-200 text-gray-600'
              }`}
            >
              Toda la flota
            </button>
            <button
              type="button"
              onClick={() => onChange({ vehicleScope: 'selected' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                draft.vehicleScope === 'selected' ? 'bg-orange-50 border-orange-300 text-orange-600' : 'border-gray-200 text-gray-600'
              }`}
            >
              Seleccionados
            </button>
          </div>
          {draft.vehicleScope === 'selected' && (
            <>
              <input
                value={vehicleSearch}
                onChange={e => setVehicleSearch(e.target.value)}
                placeholder="Buscar vehículo..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <div className="max-h-28 overflow-y-auto border border-gray-100 rounded-lg divide-y">
                {filteredVehicles.map(v => (
                  <label key={v.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={draft.selectedVehicleIds.includes(v.id)}
                      onChange={() => toggleVehicle(v.id)}
                      className="rounded"
                    />
                    <span className="font-medium">{v.economic_num}</span>
                    <span className="text-gray-400 text-xs">{v.plates}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </div>
    </div>
  )
}
