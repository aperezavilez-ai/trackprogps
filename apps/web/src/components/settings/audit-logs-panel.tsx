'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'

interface AuditRow {
  id: string
  action: string
  table_name: string | null
  record_id: string | null
  created_at: string
  user: { full_name: string; email: string } | null
}

export function AuditLogsPanel() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/audit-logs?per_page=50')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'No se pudo cargar la auditoría')
        return
      }
      setRows(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4" /> Registro de auditoría
      </h2>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Sin registros de auditoría.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">Fecha</th>
                <th className="pb-2 pr-4">Acción</th>
                <th className="pb-2 pr-4">Tabla</th>
                <th className="pb-2">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('es-MX')}
                  </td>
                  <td className="py-2 pr-4 font-medium">{r.action}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.table_name ?? '—'}</td>
                  <td className="py-2 text-gray-600">{r.user?.full_name ?? r.user?.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
