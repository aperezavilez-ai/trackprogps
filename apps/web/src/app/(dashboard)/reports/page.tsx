'use client'

import { useState } from 'react'
import { BarChart2, Download, Loader2, Calendar } from 'lucide-react'

type ReportType = 'kilometrage' | 'trips' | 'speed' | 'alerts' | 'idle'

const REPORT_TYPES = [
  { id: 'kilometrage' as ReportType, label: 'Kilometraje por vehículo', icon: '📏', desc: 'Km recorridos, tiempo en movimiento y detenido' },
  { id: 'trips'       as ReportType, label: 'Registro de viajes',       icon: '🗺️', desc: 'Historial de todos los viajes por fecha' },
  { id: 'speed'       as ReportType, label: 'Excesos de velocidad',     icon: '🚨', desc: 'Eventos de velocidad con ubicación y conductor' },
  { id: 'alerts'      as ReportType, label: 'Historial de alertas',     icon: '⚠️', desc: 'Todas las alertas generadas en el período' },
  { id: 'idle'        as ReportType, label: 'Tiempo detenido (ralentí)', icon: '⏱️', desc: 'Vehículos encendidos sin movimiento' },
]

export default function ReportsPage() {
  const [selected, setSelected]   = useState<ReportType | null>(null)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [format, setFormat]       = useState<'csv' | 'pdf'>('csv')
  const [loading, setLoading]     = useState(false)
  const [preview, setPreview]     = useState<unknown[] | null>(null)

  // Quick presets
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

  async function generateReport() {
    if (!selected || !dateFrom || !dateTo) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: selected, date_from: dateFrom, date_to: dateTo, format })
      const res  = await fetch(`/api/reports?${params}`)
      if (format === 'csv') {
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = `reporte-${selected}-${dateFrom}.csv`; a.click()
      } else {
        const data = await res.json()
        setPreview(data.data)
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">Genera reportes de tu flota en CSV o PDF</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: config */}
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

        {/* Right: date + format + generate */}
        <div className="lg:col-span-2 space-y-4">
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
