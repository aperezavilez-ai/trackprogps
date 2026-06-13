'use client'

import { useState, useEffect, useCallback } from 'react'
import { APIProvider, Map, Circle, Polygon, AdvancedMarker } from '@vis.gl/react-google-maps'
import { Plus, Pencil, Trash2, MapPin, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Geofence {
  id: string; name: string; type: 'circular' | 'polygon'
  geometry: { type: string; coordinates: number[] | number[][][] }
  radius_m: number | null; color: string
  alert_on_enter: boolean; alert_on_exit: boolean
  is_active: boolean; created_at: string
}

const API_KEY = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? ''

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editFence, setEditFence] = useState<Geofence | null>(null)
  const [selected, setSelected]   = useState<string | null>(null)

  async function loadGeofences() {
    const res  = await fetch('/api/geofences')
    const data = await res.json()
    setGeofences(data.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadGeofences() }, [])

  async function toggleActive(fence: Geofence) {
    await fetch(`/api/geofences/${fence.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !fence.is_active }),
    })
    setGeofences(prev => prev.map(f => f.id === fence.id ? { ...f, is_active: !f.is_active } : f))
  }

  async function deleteFence(id: string) {
    if (!confirm('¿Eliminar esta geocerca?')) return
    await fetch(`/api/geofences/${id}`, { method: 'DELETE' })
    setGeofences(prev => prev.filter(f => f.id !== id))
    if (selected === id) setSelected(null)
  }

  function getFenceCenter(fence: Geofence): google.maps.LatLngLiteral | null {
    const coords = fence.geometry.coordinates
    if (fence.type === 'circular' && Array.isArray(coords) && typeof coords[0] === 'number') {
      return { lat: coords[1] as number, lng: coords[0] as number }
    }
    return null
  }

  function getPolygonPath(fence: Geofence): google.maps.LatLngLiteral[] {
    if (fence.type !== 'polygon') return []
    const outer = (fence.geometry.coordinates as number[][][])[0] ?? []
    return outer.map(([lng, lat]) => ({ lat: lat!, lng: lng! }))
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Geocercas</h1>
          <p className="text-sm text-gray-500 mt-1">{geofences.length} zonas configuradas</p>
        </div>
        <button onClick={() => { setEditFence(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Nueva geocerca
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Sidebar list */}
        <div className="lg:col-span-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : geofences.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay geocercas configuradas</p>
            </div>
          ) : geofences.map(fence => (
            <div key={fence.id}
              onClick={() => setSelected(fence.id === selected ? null : fence.id)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected === fence.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ background: fence.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{fence.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fence.type === 'circular' ? `⭕ Circular · ${fence.radius_m}m` : '⬡ Polígono'}
                  </div>
                  <div className="flex gap-2 mt-1.5 text-xs">
                    {fence.alert_on_enter && <span className="text-blue-600">↗ Entrada</span>}
                    {fence.alert_on_exit  && <span className="text-orange-600">↙ Salida</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <button onClick={e => { e.stopPropagation(); void toggleActive(fence) }} className="text-gray-400 hover:text-blue-600">
                    {fence.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); setEditFence(fence); setShowModal(true) }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={e => { e.stopPropagation(); void deleteFence(fence.id) }}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-gray-200">
          <APIProvider apiKey={API_KEY}>
            <Map
              defaultCenter={{ lat: 19.4326, lng: -99.1332 }}
              defaultZoom={11}
              mapId="geofences-map"
              gestureHandling="greedy"
            >
              {geofences.map(fence => {
                const isSelected = fence.id === selected
                if (fence.type === 'circular') {
                  const center = getFenceCenter(fence)
                  if (!center) return null
                  return (
                    <Circle key={fence.id}
                      center={center} radius={fence.radius_m ?? 500}
                      fillColor={fence.color} fillOpacity={isSelected ? 0.3 : 0.15}
                      strokeColor={fence.color} strokeWeight={isSelected ? 3 : 1.5}
                      onClick={() => setSelected(fence.id === selected ? null : fence.id)}
                    />
                  )
                } else {
                  const path = getPolygonPath(fence)
                  if (!path.length) return null
                  return (
                    <Polygon key={fence.id}
                      paths={path}
                      fillColor={fence.color} fillOpacity={isSelected ? 0.3 : 0.15}
                      strokeColor={fence.color} strokeWeight={isSelected ? 3 : 1.5}
                      onClick={() => setSelected(fence.id === selected ? null : fence.id)}
                    />
                  )
                }
              })}
            </Map>
          </APIProvider>
        </div>
      </div>

      {showModal && (
        <GeofenceModal
          fence={editFence}
          onClose={() => { setShowModal(false); setEditFence(null) }}
          onSave={() => { setShowModal(false); setEditFence(null); void loadGeofences() }}
        />
      )}
    </div>
  )
}

function GeofenceModal({ fence, onClose, onSave }: { fence: Geofence | null; onClose: () => void; onSave: () => void }) {
  const isEdit = !!fence?.id
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm] = useState({
    name:            fence?.name ?? '',
    type:            fence?.type ?? 'circular',
    radius_m:        fence?.radius_m ?? 500,
    color:           fence?.color ?? '#3B82F6',
    alert_on_enter:  fence?.alert_on_enter ?? true,
    alert_on_exit:   fence?.alert_on_exit ?? true,
    lat:             '',
    lng:             '',
  })
  const set = (f: string, v: string | number | boolean) => setForm(p => ({ ...p, [f]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const geometry = form.type === 'circular'
        ? { type: 'Point', coordinates: [parseFloat(form.lng), parseFloat(form.lat)] }
        : null // polygon requires drawing tool

      const payload = {
        name: form.name, type: form.type, color: form.color,
        alert_on_enter: form.alert_on_enter, alert_on_exit: form.alert_on_exit,
        radius_m: form.type === 'circular' ? form.radius_m : null,
        geometry,
      }
      const url = isEdit ? `/api/geofences/${fence!.id}` : '/api/geofences'
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      onSave()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar geocerca' : 'Nueva geocerca'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Bodega Central"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="circular">⭕ Circular</option>
                <option value="polygon">⬡ Polígono</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-xl px-2 cursor-pointer" />
            </div>
          </div>
          {form.type === 'circular' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Radio: {form.radius_m.toLocaleString()} metros
              </label>
              <input type="range" min={50} max={50000} step={50} value={form.radius_m}
                onChange={e => set('radius_m', parseInt(e.target.value))} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>50m</span><span>50km</span>
              </div>
            </div>
          )}
          {form.type === 'circular' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Latitud</label>
                <input type="number" step="any" value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="19.4326"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Longitud</label>
                <input type="number" step="any" value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="-99.1332"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[['alert_on_enter', 'Alertar en entrada'], ['alert_on_exit', 'Alertar en salida']].map(([f, l]) => (
              <label key={f} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form[f as keyof typeof form] as boolean}
                  onChange={e => set(f, e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700">{l}</span>
              </label>
            ))}
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : isEdit ? 'Guardar' : 'Crear geocerca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
