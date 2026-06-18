'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Pencil, Trash2, Loader2, X, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import type { DriverWithUnits } from '@/lib/fleet/driver-types'

interface Props { drivers: DriverWithUnits[]; count: number; page: number; perPage: number; search: string }

export function DriversTable({ drivers, count, page, perPage, search }: Props) {
  const router = useRouter()
  const { canWriteFleet } = usePermissions()
  const [searchVal, setSearchVal] = useState(search)
  const [showModal, setShowModal] = useState(false)
  const [editDriver, setEditDriver] = useState<DriverWithUnits | null>(null)
  const totalPages = Math.ceil(count / perPage)

  const openAdd = () => { setEditDriver(null); setShowModal(true) }

  useEffect(() => {
    const btn = document.getElementById('btn-add-driver')
    if (!btn) return
    btn.addEventListener('click', openAdd)
    return () => btn.removeEventListener('click', openAdd)
  }, [])

  function daysUntilExpiry(date: string) {
    if (!date || date === 'N/A') return 999
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  }

  function unitBadge(d: DriverWithUnits) {
    if (d.unit_count === 0) return <span className="text-xs text-gray-400">Sin unidades</span>
    const offline = d.unit_count - d.online_count
    return (
      <div>
        <span className="text-sm font-medium text-gray-900">{d.unit_count} unidad{d.unit_count !== 1 ? 'es' : ''}</span>
        <div className="text-xs mt-0.5">
          {d.online_count > 0 && <span className="text-green-600">{d.online_count} en línea</span>}
          {d.online_count > 0 && offline > 0 && <span className="text-gray-400"> · </span>}
          {offline > 0 && <span className="text-gray-500">{offline} offline</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex gap-3 p-4 border-b border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') router.push(`/drivers?search=${searchVal}`) }}
            placeholder="Buscar por nombre, licencia, teléfono..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Cliente', 'Contacto', 'Unidades', 'Licencia', 'Estado', ''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {drivers.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No hay clientes registrados</td></tr>
          ) : drivers.map(d => {
            const days = daysUntilExpiry(d.license_exp)
            const expirySoon = days <= 30
            const expired    = days <= 0
            const showLicense = d.license_num && d.license_num !== 'N/A'

            return (
              <tr
                key={d.id}
                className="hover:bg-orange-50/40 cursor-pointer group"
                onClick={() => router.push(`/drivers/${d.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-sm font-semibold text-purple-700">
                      {d.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 group-hover:text-orange-600">{d.full_name}</div>
                      <div className="text-xs text-gray-500">{d.email ?? ''}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 ml-auto" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">{d.phone ?? '—'}</div>
                </td>
                <td className="px-4 py-3">{unitBadge(d)}</td>
                <td className="px-4 py-3">
                  {showLicense ? (
                    <>
                      <div className="text-sm font-mono text-gray-900">{d.license_num}</div>
                      <div className={`text-xs flex items-center gap-1 mt-0.5 ${expired ? 'text-red-600' : expirySoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                        {(expired || expirySoon) && <AlertCircle className="w-3 h-3" />}
                        {expired ? 'Expirada' : `Vence: ${new Date(d.license_exp).toLocaleDateString('es-MX')}`}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium
                    ${d.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {d.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  {canWriteFleet && (
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setEditDriver(d); setShowModal(true) }}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={async () => {
                      if (!confirm('¿Desactivar cliente?')) return
                      await fetch(`/api/drivers/${d.id}`, { method: 'DELETE' })
                      router.refresh()
                    }} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">{count} clientes</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => router.push(`/drivers?page=${page - 1}&search=${search}`)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
            <button disabled={page === totalPages} onClick={() => router.push(`/drivers?page=${page + 1}&search=${search}`)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}

      {showModal && canWriteFleet && (
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
  driver: DriverWithUnits | null; onClose: () => void; onSave: () => void
}) {
  const isEdit = !!driver?.id
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [accountType, setAccountType] = useState('business')
  const [form, setForm] = useState({
    full_name:   driver?.full_name ?? '',
    phone:       driver?.phone ?? '',
    email:       driver?.email ?? '',
    license_num: driver?.license_num === 'N/A' ? '' : (driver?.license_num ?? ''),
    license_exp: driver?.license_exp?.slice(0, 10) ?? '',
  })
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const licenseRequired = accountType === 'business'

  useEffect(() => {
    fetch('/api/vehicle-groups')
      .then(r => r.json())
      .then(json => setAccountType(json.account_type ?? 'business'))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const url    = isEdit ? `/api/drivers/${driver!.id}` : '/api/drivers'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          license_num: form.license_num || (licenseRequired ? undefined : 'N/A'),
          license_exp: form.license_exp || (licenseRequired ? undefined : new Date(Date.now() + 365 * 86400000 * 5).toISOString().slice(0, 10)),
        }),
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
    { label: 'Correo electrónico', field: 'email',      type: 'email', placeholder: 'cliente@empresa.com', required: false },
    { label: licenseRequired ? 'Número de licencia *' : 'Número de licencia', field: 'license_num', type: 'text', placeholder: 'XXXXX123456', required: licenseRequired },
    { label: licenseRequired ? 'Vencimiento de licencia *' : 'Vencimiento de licencia', field: 'license_exp', type: 'date', placeholder: '', required: licenseRequired },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fields.map(({ label, field, type, placeholder, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[field] ?? ''}
                onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
              className="flex-1 bg-orange-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
