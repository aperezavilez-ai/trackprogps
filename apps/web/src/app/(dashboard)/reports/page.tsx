'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download, Loader2, Users } from 'lucide-react'

type ReportType = 'kilometrage' | 'trips' | 'speed' | 'alerts' | 'idle'

interface FilterOption {
  id: string
  name: string
  company_id?: string
  driver_id?: string | null
  plates?: string
  economic_num?: string
}

const REPORT_TYPES = [
  { id: 'kilometrage' as ReportType, label: 'Kilometraje por vehículo', icon: '📏', desc: 'Km recorridos, tiempo en movimiento y detenido' },
  { id: 'trips'       as ReportType, label: 'Registro de viajes',       icon: '🗺️', desc: 'Historial de todos los viajes por fecha' },
  { id: 'speed'       as ReportType, label: 'Excesos de velocidad',     icon: '🚨', desc: 'Eventos de velocidad con ubicación y conductor' },
  { id: 'alerts'      as ReportType, label: 'Historial de alertas',     icon: '⚠️', desc: 'Todas las alertas generadas en el período' },
  { id: 'idle'        as ReportType, label: 'Tiempo detenido (ralentí)', icon: '⏱️', desc: 'Vehículos encendidos sin movimiento' },
]

export default function ReportsPage() {
  const [selected, setSelected]       = useState<ReportType | null>(null)
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [format, setFormat]           = useState<'csv' | 'pdf'>('csv')
  const [loading, setLoading]         = useState(false)
  const [loadingOpts, setLoadingOpts] = useState(true)

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [companies, setCompanies]       = useState<FilterOption[]>([])
  const [drivers, setDrivers]           = useState<FilterOption[]>([])
  const [vehicles, setVehicles]         = useState<FilterOption[]>([])

  const [companyId, setCompanyId] = useState('')
  const [driverId, setDriverId]   = useState('')
  const [vehicleId, setVehicleId] = useState('')

  useEffect(() => {
    fetch('/api/reports/options')
      .then(r => r.json())
      .then(data => {
        setIsSuperAdmin(data.is_super_admin ?? false)
        setCompanies((data.companies ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
        setDrivers((data.drivers ?? []).map((d: { id: string; full_name: string; company_id: string }) => ({
          id: d.id, name: d.full_name, company_id: d.company_id,
        })))
        setVehicles((data.vehicles ?? []).map((v: { id: string; economic_num: string; plates: string; driver_id: string | null; company_id: string }) => ({
          id: v.id, name: `${v.economic_num} (${v.plates})`, company_id: v.company_id, driver_id: v.driver_id,
          economic_num: v.economic_num, plates: v.plates,
        })))
      })
      .finally(() => setLoadingOpts(false))
  }, [])

  const filteredDrivers = useMemo(() => {
    if (!companyId) return drivers
    return drivers.filter(d => d.company_id === companyId)
  }, [drivers, companyId])

  const filteredVehicles = useMemo(() => {
    let list = vehicles
    if (companyId) list = list.filter(v => v.company_id === companyId)
    if (driverId) list = list.filter(v => v.driver_id === driverId)
    return list
  }, [vehicles, companyId, driverId])

  function applyPreset(preset: 'today' | 'week' | 'month') {
    const now = new Date()
    const to = now.toISOString().slice(0, 10)
    let from: string
    if (preset === 'today') { from = to }
    else if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); from = d.toISOString().slice(0, 10) }
    else { const d = new Date(now); d.setDate(1); from = d.toISOString().slice(0, 10) }
    setDateFrom(from)
    setDateTo(to)
  }

  function onCompanyChange(id: string) {
    setCompanyId(id)
    setDriverId('')
    setVehicleId('')
  }

  function onDriverChange(id: string) {
    setDriverId(id)
    setVehicleId('')
  }

  async function generateReport() {
    if (!selected || !dateFrom || !dateTo) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: selected, date_from: dateFrom, date_to: dateTo, format })
      if (companyId) params.set('company_id', companyId)
      if (driverId)  params.set('driver_id', driverId)
      if (vehicleId) params.set('vehicle_id', vehicleId)

      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al generar el reporte')
        return
      }
      if (format === 'csv' || format === 'pdf') {
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url
        a.download = `reporte-${selected}-${dateFrom}.${format}`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        await res.json()
      }
    } finally { setLoading(false) }
  }

  const scopeLabel = driverId
    ? filteredDrivers.find(d => d.id === driverId)?.name
    : vehicleId
      ? filteredVehicles.find(v => v.id === vehicleId)?.name
      : companyId
        ? companies.find(c => c.id === companyId)?.name
        : 'Toda la flota'

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">Genera reportes de tu flota en CSV o PDF</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Tipo de reporte</h2>
            <div className="space-y-2">
              {REPORT_TYPES.map(r => (
                <button key={r.id} onClick={() => setSelected(r.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition border ${selected === r.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-lg">{r.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{r.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Filtro por usuario/cliente */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">Ámbito del reporte</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Filtra por empresa, cliente o vehículo. Si no seleccionas nada, incluye toda la flota.
            </p>

            {loadingOpts ? (
              <p className="text-sm text-gray-400">Cargando opciones...</p>
            ) : (
              <div className={`grid gap-3 ${isSuperAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {isSuperAdmin && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                    <select value={companyId} onChange={e => onCompanyChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Todas las empresas</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                  <select value={driverId} onChange={e => onDriverChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los clientes</option>
                    {filteredDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vehículo</label>
                  <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los vehículos</option>
                    {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {(companyId || driverId || vehicleId) && (
              <p className="mt-3 text-xs text-blue-600 font-medium">
                Reporte para: {scopeLabel}
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Período</h2>
            <div className="flex gap-2 mb-3">
              {[['today', 'Hoy'], ['week', 'Últimos 7 días'], ['month', 'Este mes']].map(([p, l]) => (
                <button key={p} onClick={() => applyPreset(p as 'today' | 'week' | 'month')}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">
                  {l}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Formato de salida</h2>
            <div className="flex gap-3">
              {(['csv', 'pdf'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${format === f ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                  {f === 'csv' ? '📊 CSV (Excel)' : '📄 PDF'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={!selected || !dateFrom || !dateTo || loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3.5 rounded-xl transition"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando reporte...</>
              : <><Download className="w-4 h-4" /> Generar y descargar</>}
          </button>

          {!selected && (
            <p className="text-center text-xs text-gray-400">Selecciona un tipo de reporte para continuar</p>
          )}
        </div>
      </div>
    </div>
  )
}
