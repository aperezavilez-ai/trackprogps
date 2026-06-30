'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Radio, Wifi, WifiOff, Plus, RefreshCw, Loader2, X, Smartphone } from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import { DEVICE_MODEL_GROUPS, DEFAULT_DEVICE_MODEL } from '@/lib/device-models'

interface Device {
  id: string; imei: string; model: string; firmware_ver: string | null
  sim_iccid: string | null; phone_num: string | null; status: string; last_seen: string | null
  source_type?: string
  vehicle: { economic_num: string; plates: string } | null
}

interface CompanyOption {
  id: string
  name: string
  account_type: string
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  online:   { color: '#22C55E', bg: '#F0FDF4', label: 'En línea' },
  offline:  { color: '#6B7280', bg: '#F9FAFB', label: 'Desconectado' },
  no_signal:{ color: '#EAB308', bg: '#FEFCE8', label: 'Sin señal' },
  unknown:  { color: '#9CA3AF', bg: '#F3F4F6', label: 'Desconocido' },
}

export default function DevicesPage() {
  const { canWriteFleet, role, companyId } = usePermissions()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch]   = useState('')
  const [filter, setFilter] = useState<'all' | 'hardware' | 'mobile'>('all')
  const needsCompanyPick = role === 'super_admin' && !companyId

  async function loadDevices() {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('source_type', filter)
    const res  = await fetch(`/api/devices?${params}`)
    const data = await res.json()
    setDevices(data.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadDevices() }, [filter])

  const filtered = devices.filter(d =>
    d.imei.includes(search) || d.model.toLowerCase().includes(search.toLowerCase()) ||
    (d.vehicle?.plates ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:   devices.length,
    online:  devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline' || d.status === 'no_signal').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dispositivos GPS</h1>
          <p className="text-xs text-gray-400 mt-1">
            GPS hardware (Teltonika y más) · Móviles de choferes (opcional en plan flota)
          </p>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>{stats.total} total</span>
            <span className="text-green-600 font-medium">● {stats.online} en línea</span>
            <span className="text-gray-400">○ {stats.offline} desconectados</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadDevices()} className="p-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canWriteFleet && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Registrar dispositivo
          </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'hardware', 'mobile'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === f ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            {f === 'all' ? 'Todos' : f === 'hardware' ? 'GPS vehículo' : 'Móviles'}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por IMEI, modelo o placas..."
          className="w-full max-w-sm border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Dispositivo', 'IMEI', 'SIM', 'Vehículo asignado', 'Estado', 'Última conexión'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No se encontraron dispositivos</td></tr>
              ) : filtered.map(d => {
                const cfg = STATUS_STYLES[d.status] ?? STATUS_STYLES['unknown']!
                const lastSeen = d.last_seen ? (() => {
                  const s = Math.floor((Date.now() - new Date(d.last_seen).getTime()) / 1000)
                  if (s < 60) return `Hace ${s}s`
                  if (s < 3600) return `Hace ${Math.floor(s / 60)}min`
                  if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`
                  return new Date(d.last_seen).toLocaleDateString('es-MX')
                })() : 'Nunca'

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/devices/${d.id}`} className="flex items-center gap-2 group">
                        {d.source_type === 'mobile'
                          ? <Smartphone className="w-4 h-4 text-teal-500" />
                          : <Radio className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />}
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-orange-500">{d.model}</div>
                          {d.source_type === 'mobile' && <div className="text-xs text-teal-600">App móvil</div>}
                          {d.firmware_ver && d.source_type !== 'mobile' && <div className="text-xs text-gray-400">FW: {d.firmware_ver}</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.imei}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.phone_num ?? d.sim_iccid?.slice(-8) ?? '—'}</td>
                    <td className="px-4 py-3">
                      {d.vehicle
                        ? <span className="text-sm font-medium text-orange-500">{d.vehicle.economic_num} ({d.vehicle.plates})</span>
                        : <span className="text-xs text-gray-400">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border`}
                        style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}>
                        {d.status === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{lastSeen}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && canWriteFleet && (
        <DeviceModal
          needsCompanyPick={needsCompanyPick}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); void loadDevices() }}
        />
      )}
    </div>
  )
}

function DeviceModal({
  needsCompanyPick,
  onClose,
  onSave,
}: {
  needsCompanyPick: boolean
  onClose: () => void
  onSave: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState('')
  const [form, setForm]       = useState({ imei: '', model: DEFAULT_DEVICE_MODEL, sim_iccid: '', phone_num: '', firmware_ver: '', model_custom: '' })
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const isCustomModel = form.model === 'Otro'

  useEffect(() => {
    if (!needsCompanyPick) return
    void fetch('/api/admin/companies')
      .then(r => r.json())
      .then(json => setCompanies(json.data ?? []))
  }, [needsCompanyPick])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload: Record<string, string> = {
        imei: form.imei,
        model: isCustomModel ? (form.model_custom.trim() || 'Otro') : form.model,
        sim_iccid: form.sim_iccid,
        phone_num: form.phone_num,
        firmware_ver: form.firmware_ver,
      }
      if (needsCompanyPick) {
        if (!companyId) throw new Error('Selecciona la empresa cliente')
        payload.company_id = companyId
      }
      const res = await fetch('/api/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      onSave()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Registrar GPS en vehículo</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {needsCompanyPick && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa cliente *</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">— Seleccionar —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.account_type})</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Para rastreo solo móvil, usa la sección Móviles o el alta del cliente en registro.</p>
            </div>
          )}
          {[
            { label: 'IMEI (15 dígitos) *', field: 'imei', type: 'text', placeholder: '123456789012345', required: true, maxLength: 15 },
            { label: 'ICCID de SIM', field: 'sim_iccid', type: 'text', placeholder: '8952140...', required: false },
            { label: 'Número de teléfono SIM', field: 'phone_num', type: 'text', placeholder: '+52 55 ...', required: false },
            { label: 'Versión de firmware', field: 'firmware_ver', type: 'text', placeholder: '03.27.07.Rev.07', required: false },
          ].map(({ label, field, placeholder, required, maxLength }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
              <input value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)}
                placeholder={placeholder} required={required} maxLength={maxLength}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
            <select value={form.model} onChange={e => set('model', e.target.value)} required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              {DEVICE_MODEL_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.models.map(m => (
                    <option key={`${group.label}-${m}`} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {isCustomModel && (
              <input
                value={form.model_custom}
                onChange={e => set('model_custom', e.target.value)}
                placeholder="Escribe el modelo exacto"
                required
                className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
            <p className="mt-1.5 text-xs text-gray-400">
              Teltonika FMB/FMC/FMM tienen soporte completo (posición, comandos, micrófono). Otros marcas: consulta compatibilidad.
            </p>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-orange-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando...</> : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
