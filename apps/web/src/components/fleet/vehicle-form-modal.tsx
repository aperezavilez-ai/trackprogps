'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'

interface Vehicle {
  id?: string
  economic_num?: string
  plates?: string
  brand?: string
  model?: string
  year?: number
  type?: string
  color?: string | null
  max_speed?: number
  notes?: string | null
  device?: { id: string } | null
  driver?: { id: string } | null
}

interface Props {
  vehicle: Vehicle | null
  onClose: () => void
  onSave: () => void
}

const VEHICLE_TYPES = [
  { value: 'sedan',      label: 'Automóvil (sedán)' },
  { value: 'suv',        label: 'SUV' },
  { value: 'pickup',     label: 'Pickup' },
  { value: 'van',        label: 'Van' },
  { value: 'truck',      label: 'Camión' },
  { value: 'bus',        label: 'Autobús' },
  { value: 'motorcycle', label: 'Motocicleta' },
  { value: 'other',      label: 'Otro' },
]

export function VehicleFormModal({ vehicle, onClose, onSave }: Props) {
  const isEdit = !!vehicle?.id
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    economic_num: vehicle?.economic_num ?? '',
    plates:       vehicle?.plates ?? '',
    brand:        vehicle?.brand ?? '',
    model:        vehicle?.model ?? '',
    year:         vehicle?.year ?? new Date().getFullYear(),
    type:         vehicle?.type ?? 'other',
    color:        vehicle?.color ?? '',
    max_speed:    vehicle?.max_speed ?? 120,
    notes:        vehicle?.notes ?? '',
  })

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const url = isEdit ? `/api/vehicles/${vehicle!.id}` : '/api/vehicles'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, year: Number(form.year), max_speed: Number(form.max_speed) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Número económico *</label>
              <input required value={form.economic_num} onChange={e => set('economic_num', e.target.value)}
                placeholder="ECO-001"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Placas *</label>
              <input required value={form.plates} onChange={e => set('plates', e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Marca *</label>
              <input required value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="Kenworth"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
              <input required value={form.model} onChange={e => set('model', e.target.value)}
                placeholder="T680"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Año *</label>
              <input required type="number" value={form.year} onChange={e => set('year', e.target.value)}
                min={1990} max={2030}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de vehículo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
              <input value={form.color} onChange={e => set('color', e.target.value)}
                placeholder="Blanco"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Row 4 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Velocidad máxima (km/h) — Límite para alertas
            </label>
            <div className="flex items-center gap-4">
              <input type="range" min={60} max={200} value={form.max_speed}
                onChange={e => set('max_speed', e.target.value)}
                className="flex-1" />
              <span className="text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                {form.max_speed} km/h
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Observaciones adicionales..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : isEdit ? 'Guardar cambios' : 'Crear vehículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
