'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Webhook } from 'lucide-react'

const EVENT_OPTIONS = [
  { value: 'alert.created', label: 'Alerta creada' },
  { value: 'geofence.enter', label: 'Entrada geocerca' },
  { value: 'geofence.exit', label: 'Salida geocerca' },
  { value: '*', label: 'Todos los eventos' },
]

interface WebhookRow {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  failure_count: number
  last_success_at: string | null
  last_failure_at: string | null
  created_at: string
}

export function WebhooksPanel() {
  const [hooks, setHooks] = useState<WebhookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', events: ['alert.created'] as string[] })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/webhooks')
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Error al cargar webhooks')
        setHooks([])
        return
      }
      setHooks(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNewSecret(null)
    try {
      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Error al crear webhook')
        return
      }
      setNewSecret(json.secret as string)
      setForm({ name: '', url: '', events: ['alert.created'] })
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('¿Desactivar este webhook?')) return
    setSaving(true)
    try {
      await fetch(`/api/settings/webhooks/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setSaving(false)
    }
  }

  function toggleEvent(ev: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Webhooks salientes
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Recibe eventos en tu ERP/CRM. Firma HMAC en header <code className="text-xs bg-gray-100 px-1 rounded">X-TrackPro-Signature</code>.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Nuevo webhook
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {newSecret && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-medium text-amber-900 mb-2">Secret generado — guárdalo</p>
          <code className="text-xs break-all">{newSecret}</code>
        </div>
      )}

      {showForm && (
        <form onSubmit={createWebhook} className="mb-6 p-4 bg-gray-50 rounded-xl space-y-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nombre (ERP Producción)" required
            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm" />
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            type="url" placeholder="https://tu-servidor.com/hooks/trackpro" required
            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            {EVENT_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={form.events.includes(opt.value)}
                  onChange={() => toggleEvent(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm">
              {saving ? 'Guardando...' : 'Crear webhook'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button>
          </div>
        </form>
      )}

      {hooks.filter(h => h.is_active).length === 0 ? (
        <p className="text-sm text-gray-500">No hay webhooks activos.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {hooks.filter(h => h.is_active).map(h => (
            <div key={h.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{h.name}</p>
                <p className="text-xs text-gray-500 truncate">{h.url}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {h.events.join(', ')}
                  {h.last_success_at ? ` · OK ${new Date(h.last_success_at).toLocaleString('es-MX')}` : ''}
                  {h.failure_count > 0 ? ` · ${h.failure_count} fallos` : ''}
                </p>
              </div>
              <button type="button" disabled={saving} onClick={() => revoke(h.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
