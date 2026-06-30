'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Key, Loader2, Plus, Trash2 } from 'lucide-react'

interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/settings/api-keys')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'No se pudieron cargar las claves')
        setKeys([])
        return
      }
      setKeys(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNewKey(null)
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), permissions: ['read'] }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Error al crear la clave')
        return
      }
      setNewKey(json.key as string)
      setName('')
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('¿Revocar esta API key? Las integraciones que la usen dejarán de funcionar.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? 'No se pudo revocar')
        return
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  function copyKey() {
    if (newKey) void navigator.clipboard.writeText(newKey)
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
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Key className="w-4 h-4" /> API Keys
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Integra TrackPro con ERP, TMS u otros sistemas. Usa el header <code className="text-xs bg-gray-100 px-1 rounded">X-API-Key</code>.
            </p>
            <p className="text-xs text-gray-400 mt-1">Base URL: https://trackprogps.mx/api/v1</p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
            >
              <Plus className="w-4 h-4" /> Nueva clave
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        {newKey && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-medium text-amber-900 mb-2">Clave creada — cópiala ahora</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border rounded-lg px-3 py-2 break-all">{newKey}</code>
              <button type="button" onClick={copyKey} className="p-2 rounded-lg border hover:bg-white">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={createKey} className="mb-6 p-4 bg-gray-50 rounded-xl space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="ERP Producción"
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm disabled:opacity-60">
                {saving ? 'Creando...' : 'Generar clave'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border text-sm">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-gray-500">No hay claves API activas.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {keys.filter(k => k.is_active).map(k => (
              <div key={k.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{k.key_prefix}••••••••</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {k.permissions.join(', ')}
                    {k.last_used ? ` · Último uso: ${new Date(k.last_used).toLocaleString('es-MX')}` : ' · Sin uso'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => revokeKey(k.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Revocar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
