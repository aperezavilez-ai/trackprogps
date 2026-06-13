'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Pencil, Trash2, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react'

interface Driver {
  id: string; full_name: string; phone: string | null; email: string | null
  license_num: string; license_exp: string; is_active: boolean
  vehicle: { economic_num: string; plates: string } | null
}

interface Props { drivers: Driver[]; count: number; page: number; perPage: number; search: string }

export function DriversTable({ drivers, count, page, perPage, search }: Props) {
  const router = useRouter()
  const [searchVal, setSearchVal] = useState(search)
  const [showModal, setShowModal] = useState(false)
  const [editDriver, setEditDriver] = useState<Driver | null>(null)
  const totalPages = Math.ceil(count / perPage)

  const openAdd = () => { setEditDriver(null); setShowModal(true) }

  useEffect(() => {
    const btn = document.getElementById('btn-add-driver')
    if (!btn) return
    btn.addEventListener('click', openAdd)
    return () => btn.removeEventListener('click', openAdd)
  }, [])

  function daysUntilExpiry(date: string) {
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex gap-3 p-4 border-b border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') router.push(`/drivers?search=${searchVal}`) }}
            placeholder="Buscar por nombre, licencia, teléfono..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Chofer', 'Licencia', 'Contacto', 'Vehículo asignado', 'Estado', ''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {drivers.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No hay choferes registrados</td></tr>
          ) : drivers.map(d => {
            const days = daysUntilExpiry(d.license_exp)
            const expirySoon = days <= 30
            const expired    = days <= 0
            return (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-sm font-semibold text-purple-700">
                      {d.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{d.full_name}</div>
                      <div className="text-xs text-gray-500">{d.email ?? ''}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-mono text-gray-900">{d.license_num}</div>
                  <div className={`text-xs flex items-center gap-1 mt-0.5 ${expired ? 'text-red-600' : expirySoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {(expired || expirySoon) && <AlertCircle className="w-3 h-3" />}
                    {expired ? 'Expirada' : `Vence: ${new Date(d.license_exp).toLocaleDateString('es-MX')}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">{d.phone ?? '—'}</div>
                </td>
                <td className="px-4 py-3">
                  {d.vehicle
                    ? <span className="text-sm font-medium text-blue-600">{d.vehicle.economic_num} ({d.vehicle.plates})</span>
                    : <span className="text-xs text-gray-400">Sin vehículo</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium
                    ${d.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {d.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setEditDriver(d); setShowModal(true) }}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={async () => {
                      if (!confirm('¿Desactivar chofer?')) return
                      await fetch(`/api/drivers/${d.id}`, { method: 'DELETE' })
                      router.refresh()
                    }} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">{count} choferes</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => router.push(`/drivers?page=${page - 1}&search=${search}`)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
            <button disabled={page === totalPages} onClick={() => router.push(`/drivers?page=${page + 1}&search=${search}`)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}

      {showModal && (
        <DriverFormModal
          driver={editDriver}
          onClose={() => { setShowModal(false); setEditDriver(null) }}
          onSave={() => { setShowModal(false); setEditDriver(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function DriverFormModal({ driver, onClose, onSave }: {
  driver: Driver | null; onClose: () => void; onSave: () => void
}) {
  const isEdit = !!driver?.id
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm] = useState({
    full_name:   driver?.full_name ?? '',
    phone:       driver?.phone ?? '',
    email:       driver?.email ?? '',
    license_num: driver?.license_num ?? '',
    license_exp: driver?.license_exp?.slice(0, 10) ?? '',
  })
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const url    = isEdit ? `/api/drivers/${driver!.id}` : '/api/drivers'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      onSave()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setLoading(false) }
  }

  const fields = [
    { label: 'Nombre completo',  field: 'full_name',   type: 'text',  placeholder: 'Juan García López',  required: true },
    { label: 'Teléfono',         field: 'phone',        type: 'tel',   placeholder: '+52 55 1234 5678',   required: false },
    { label: 'Correo electrónico', field: 'email',      type: 'email', placeholder: 'chofer@empresa.com', required: false },
    { label: 'Número de licencia', field: 'license_num', type: 'text', placeholder: 'XXXXX123456',        required: true },
    { label: 'Vencimiento de licencia', field: 'license_exp', type: 'date', placeholder: '', required: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar chofer' : 'Nuevo chofer'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fields.map(({ label, field, type, placeholder, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && ' *'}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[field] ?? ''}
                onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : isEdit ? 'Guardar cambios' : 'Crear chofer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
