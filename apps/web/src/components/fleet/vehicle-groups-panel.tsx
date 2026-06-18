'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Pencil, Trash2, Layers } from 'lucide-react'

interface VehicleGroup {
  id: string
  name: string
  color: string
  sort_order: number
  is_default: boolean
}

interface Props {
  canEdit: boolean
  accountType: string
}

const PRESET_COLORS = ['#F97316', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4']

export function VehicleGroupsPanel({ canEdit, accountType }: Props) {
  const [groups, setGroups] = useState<VehicleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#F97316')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/vehicle-groups')
    const json = await res.json()
    setGroups(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const groupLabel = accountType === 'family' ? 'grupos familiares' : accountType === 'personal' ? 'categorías' : 'flotillas'

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/vehicle-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setNewName('')
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/vehicle-groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setEditingId(null)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function removeGroup(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    setSaving(true)
    const res = await fetch(`/api/vehicle-groups/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Error al eliminar')
    else void load()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-semibold text-gray-900">Grupos / Flotillas</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Organiza vehículos en {groupLabel}. Los miembros familiares solo ven los grupos que les asignes.
        </p>

        {canEdit && (
          <form onSubmit={createGroup} className="flex flex-wrap gap-3 items-end mb-6">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Nuevo grupo</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder={accountType === 'family' ? 'Ej. Abuelos' : 'Ej. Zona Norte'}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <div className="flex gap-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-lg border-2 ${newColor === c ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving || !newName.trim()}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </button>
          </form>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

        {loading ? (
          <div className="py-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-4 px-4 py-3 bg-white">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: g.color }} />
                {editingId === g.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded border ${editColor === c ? 'border-gray-800' : 'border-transparent'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                    <button onClick={() => saveEdit(g.id)} disabled={saving}
                      className="text-xs text-orange-500 font-medium">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancelar</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-900">{g.name}</span>
                    {g.is_default && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Por defecto</span>
                    )}
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingId(g.id); setEditName(g.name); setEditColor(g.color) }}
                          className="p-1.5 text-gray-400 hover:text-orange-500 rounded-lg hover:bg-orange-50">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!g.is_default && (
                          <button onClick={() => removeGroup(g.id, g.name)} disabled={saving}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
