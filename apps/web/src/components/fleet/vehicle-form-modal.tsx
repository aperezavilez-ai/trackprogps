'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { resolveKmPerL } from '@/lib/map/fuel-utils'

interface VehicleGroup {
  id: string
  name: string
  color: string
}

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
  owner_name?: string | null
  group_id?: string | null
  notes?: string | null
  fuel_efficiency_km_per_l?: number | null
  device?: { id: string } | null
  driver?: { id: string } | null
  group?: VehicleGroup | null
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
  const [groups, setGroups] = useState<VehicleGroup[]>([])
  const [accountType, setAccountType] = useState<string>('business')

  const [form, setForm] = useState({
    economic_num: vehicle?.economic_num ?? '',
    plates:       vehicle?.plates ?? '',
    brand:        vehicle?.brand ?? '',
    model:        vehicle?.model ?? '',
    year:         vehicle?.year ?? new Date().getFullYear(),
    type:         vehicle?.type ?? 'sedan',
    color:        vehicle?.color ?? '',
    max_speed:    vehicle?.max_speed ?? 120,
    owner_name:   vehicle?.owner_name ?? '',
    group_id:     vehicle?.group_id ?? vehicle?.group?.id ?? '',
    notes:        vehicle?.notes ?? '',
    fuel_efficiency_km_per_l: vehicle?.fuel_efficiency_km_per_l != null
      ? String(vehicle.fuel_efficiency_km_per_l)
      : '',
  })

  const estimatedKmPerL = useMemo(
    () => resolveKmPerL({
      type: form.type,
      year: Number(form.year),
      fuel_efficiency_km_per_l: form.fuel_efficiency_km_per_l
        ? Number(form.fuel_efficiency_km_per_l)
        : null,
    }),
    [form.type, form.year, form.fuel_efficiency_km_per_l],
  )

  useEffect(() => {
    fetch('/api/vehicle-groups')
      .then(r => r.json())
      .then(json => {
        setGroups(json.data ?? [])
        setAccountType(json.account_type ?? 'business')
        if (!isEdit && json.data?.length && !form.group_id) {
          const def = json.data.find((g: VehicleGroup & { is_default?: boolean }) => g.is_default) ?? json.data[0]
          if (def) setForm(prev => ({ ...prev, group_id: def.id }))
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const economicLabel = accountType === 'business'
    ? 'Número económico *'
    : 'Nombre / alias del vehículo *'
  const economicPlaceholder = accountType === 'personal'
    ? 'Mi auto'
    : accountType === 'family'
      ? 'Auto familiar'
      : 'ECO-001'
  const economicHelp = accountType === 'business'
    ? 'Identificador interno de la unidad en tu flota (ej. ECO-001, UNIDAD-12).'
    : 'Nombre corto para identificar este vehículo en el mapa y las alertas.'

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
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          max_speed: Number(form.max_speed),
          group_id: form.group_id || null,
          owner_name: form.owner_name || null,
          fuel_efficiency_km_per_l: form.fuel_efficiency_km_per_l
            ? Number(form.fuel_efficiency_km_per_l)
            : null,
        }),
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
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{economicLabel}</label>
              <input required value={form.economic_num} onChange={e => set('economic_num', e.target.value)}
                placeholder={economicPlaceholder}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <p className="mt-1 text-xs text-gray-500">{economicHelp}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Placas *</label>
              <input required value={form.plates} onChange={e => set('plates', e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Titular</label>
              <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)}
                placeholder="Nombre titular"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo / Flotilla</label>
              <select value={form.group_id} onChange={e => set('group_id', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="" disabled>Particular, Grupo o Flotilla</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Marca *</label>
              <input required value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="Toyota"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
              <input required value={form.model} onChange={e => set('model', e.target.value)}
                placeholder="Hilux"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Año *</label>
              <input required type="number" value={form.year} onChange={e => set('year', e.target.value)}
                min={1990} max={2030}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de vehículo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
              <input value={form.color} onChange={e => set('color', e.target.value)}
                placeholder="Blanco"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Rendimiento combustible (km/L)
            </label>
            <input
              type="number"
              min={3}
              max={50}
              step={0.1}
              value={form.fuel_efficiency_km_per_l}
              onChange={e => set('fuel_efficiency_km_per_l', e.target.value)}
              placeholder={`Estimado ~${resolveKmPerL({ type: form.type, year: Number(form.year) })} km/L`}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Opcional. Si lo dejas vacío se estima por tipo y año del vehículo
              {form.fuel_efficiency_km_per_l ? '' : ` (~${estimatedKmPerL} km/L)`}.
              Se usa para calcular consumo en mapa e historial cuando no hay sensor de combustible.
            </p>
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Observaciones adicionales..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
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
              className="flex-1 bg-orange-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : isEdit ? 'Guardar cambios' : 'Crear vehículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
