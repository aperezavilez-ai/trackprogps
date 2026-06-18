'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Plus, Trash2, Zap } from 'lucide-react'

interface AlertRule {
  id: string
  type: string
  name: string
  is_active: boolean
  config: Record<string, unknown>
  channels: string[]
}

const TYPE_LABELS: Record<string, string> = {
  speed_excess: 'Exceso de velocidad',
  ignition_on: 'Motor encendido',
  ignition_off: 'Motor apagado',
  unauthorized_movement: 'Movimiento no autorizado',
  sos: 'Botón de pánico (SOS)',
  geofence_enter: 'Entrada a geocerca',
  geofence_exit: 'Salida de geocerca',
}

const CHANNEL_LABELS: Record<string, string> = {
  platform: 'Plataforma',
  email: 'Email',
  whatsapp: 'WhatsApp',
  push: 'Push',
}

export function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'speed_excess',
    name: 'Exceso de velocidad',
    speed_limit: 100,
    channels: ['platform', 'email'] as string[],
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/alert-rules')
      const json = await res.json()
      setRules(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function seedDefaults() {
    setSaving(true)
    try {
      const res = await fetch('/api/alert-rules/seed-defaults', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'No se pudieron crear las reglas')
        return
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const config = form.type === 'speed_excess' ? { speed_limit: form.speed_limit } : {}
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          name: form.name,
          config,
          channels: form.channels,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al crear regla')
        return
      }
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(rule: AlertRule) {
    await fetch(`/api/alert-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    await load()
  }

  async function deleteRule(id: string) {
    if (!confirm('¿Eliminar esta regla de alerta?')) return
    await fetch(`/api/alert-rules/${id}`, { method: 'DELETE' })
    await load()
  }

  function toggleChannel(ch: string) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
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
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Reglas de alerta
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Define qué eventos generan alertas y por qué canales se notifican.
            </p>
          </div>
          <div className="flex gap-2">
            {rules.length === 0 && (
              <button
                type="button"
                onClick={seedDefaults}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Zap className="w-4 h-4" /> Reglas recomendadas
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Nueva regla
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={createRule} className="border border-gray-100 rounded-xl p-4 mb-4 space-y-3 bg-gray-50">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value, name: TYPE_LABELS[e.target.value] ?? f.name }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            {form.type === 'speed_excess' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Límite (km/h)</label>
                <input
                  type="number"
                  min={20}
                  max={250}
                  value={form.speed_limit}
                  onChange={e => setForm(f => ({ ...f, speed_limit: Number(e.target.value) }))}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Canales</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.channels.includes(k)}
                      onChange={() => toggleChannel(k)}
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600">Cancelar</button>
              <button type="submit" disabled={saving || form.channels.length === 0} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Guardando…' : 'Crear regla'}
              </button>
            </div>
          </form>
        )}

        {rules.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Sin reglas. Usa &quot;Reglas recomendadas&quot; o crea una manualmente.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rules.map(rule => (
              <li key={rule.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {TYPE_LABELS[rule.type] ?? rule.type}
                    {rule.type === 'speed_excess' && rule.config?.speed_limit != null
                      ? ` · ${rule.config.speed_limit} km/h`
                      : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(rule.channels ?? []).map(c => CHANNEL_LABELS[c] ?? c).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleActive(rule)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {rule.is_active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button type="button" onClick={() => deleteRule(rule.id)} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
