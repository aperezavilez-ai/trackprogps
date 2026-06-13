'use client'

import { useState, useEffect } from 'react'
import { Wrench, Plus, Calendar, Gauge, DollarSign, Loader2, X } from 'lucide-react'

interface MaintenanceRecord {
  id: string; vehicle_id: string; type: string; description: string
  cost: number | null; service_date: string; next_service_date: string | null
  next_odometer: number | null; workshop: string | null; notes: string | null
  vehicle: { economic_num: string; plates: string } | null
}

const MAINTENANCE_TYPES: Record<string, { label: string; icon: string }> = {
  oil_change:    { label: 'Cambio de aceite',    icon: '🛢️' },
  tire_rotation: { label: 'Rotación de llantas', icon: '🔄' },
  brake_service: { label: 'Servicio de frenos',  icon: '🛑' },
  tune_up:       { label: 'Afinación',            icon: '🔧' },
  insurance:     { label: 'Seguro vehicular',     icon: '📋' },
  verification:  { label: 'Verificación',         icon: '✅' },
  other:         { label: 'Otro',                 icon: '⚙️' },
}

export default function MaintenancePage() {
  const [records, setRecords]   = useState<MaintenanceRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function fetchRecords() {
    setLoading(true)
    const res  = await fetch('/api/maintenance')
    const data = await res.json()
    setRecords(data.data ?? [])
    setTotal(data.count ?? 0)
    setLoading(false)
  }

  useEffect(() => { void fetchRecords() }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mantenimiento</h1>
          <p className="text-sm text-gray-500 mt-1">{total} registros</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Registrar mantenimiento
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {records.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay registros de mantenimiento</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-blue-600 text-sm hover:underline">
                Registrar el primero
              </button>
            </div>
          ) : records.map(r => {
            const mt = MAINTENANCE_TYPES[r.type] ?? MAINTENANCE_TYPES['other']!
            const nextDate = r.next_service_date ? new Date(r.next_service_date) : null
            const daysUntil = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / 86400000) : null
            const isOverdue = daysUntil !== null && daysUntil < 0
            const isSoon    = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30

            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {mt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{mt.label}</span>
                        {r.vehicle && (
                          <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                            {r.vehicle.economic_num} ({r.vehicle.plates})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{r.description}</p>
                    </div>
                    {daysUntil !== null && (
                      <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border
                        ${isOverdue ? 'bg-red-50 text-red-700 border-red-200' : isSoon ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {isOverdue ? `Vencido hace ${Math.abs(daysUntil)}d` : `En ${daysUntil}d`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.service_date).toLocaleDateString('es-MX')}
                    </span>
                    {r.cost && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${r.cost.toLocaleString('es-MX')} MXN
                      </span>
                    )}
                    {r.next_odometer && (
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Próximo: {r.next_odometer.toLocaleString()} km
                      </span>
                    )}
                    {r.workshop && <span>🏪 {r.workshop}</span>}
                    {r.next_service_date && (
                      <span>📅 Próximo: {new Date(r.next_service_date).toLocaleDateString('es-MX')}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <MaintenanceModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); void fetchRecords() }} />}
    </div>
  )
}

function MaintenanceModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [vehicles, setVehicles] = useState<{ id: string; economic_num: string; plates: string }[]>([])
  const [form, setForm] = useState({
    vehicle_id: '', type: 'oil_change', description: '',
    cost: '', service_date: new Date().toISOString().slice(0, 10),
    next_service_date: '', next_odometer: '', workshop: '', notes: '',
  })

  useEffect(() => {
    fetch('/api/vehicles?per_page=100').then(r => r.json()).then(d => setVehicles(d.data ?? []))
  }, [])

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cost: form.cost ? parseFloat(form.cost) : null,
          next_odometer: form.next_odometer ? parseFloat(form.next_odometer) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      onSave()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Registrar mantenimiento</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vehículo *</label>
            <select required value={form.vehicle_id} onChange={e => set('vehicle_id', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccionar vehículo</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.economic_num} — {v.plates}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(MAINTENANCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de servicio *</label>
              <input type="date" required value={form.service_date} onChange={e => set('service_date', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción *</label>
            <textarea required value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="Cambio de aceite 5W-30, filtro de aceite..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Costo (MXN)</label>
              <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="1,500.00"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Taller</label>
              <input type="text" value={form.workshop} onChange={e => set('workshop', e.target.value)} placeholder="Servicio Express"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Próximo servicio (fecha)</label>
              <input type="date" value={form.next_service_date} onChange={e => set('next_service_date', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Próximo servicio (km)</label>
              <input type="number" value={form.next_odometer} onChange={e => set('next_odometer', e.target.value)} placeholder="250,000"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
