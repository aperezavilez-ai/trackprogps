'use client'

import { useState, useEffect, useCallback } from 'react'
import { APIProvider, Map, Circle, Polygon } from '@vis.gl/react-google-maps'
import { Pencil, Trash2, MapPin, X, Loader2, ToggleLeft, ToggleRight, Plus } from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import { FLEET_MAP_STYLES } from '@/lib/map/vehicle-marker'
import { MEXICO_GEO_CENTER, MEXICO_DEFAULT_ZOOM } from '@/lib/map/map-viewport'
import { GeofenceDrawLayer, buildPolygonGeometry } from '@/components/geofences/geofence-draw-layer'
import { GeofenceCreatePanel, type GeofenceCreateDraft } from '@/components/geofences/geofence-create-panel'

interface Geofence {
  id: string; name: string; type: 'circular' | 'polygon'
  geometry: { type: string; coordinates: number[] | number[][][] }
  radius_m: number | null; color: string
  alert_on_enter: boolean; alert_on_exit: boolean
  is_active: boolean; created_at: string
  vehicle_ids: string[] | null
}

interface VehicleOption {
  id: string
  economic_num: string
  plates: string
  group?: { name: string; color: string } | null
}

const API_KEY = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? ''

const DEFAULT_DRAFT: GeofenceCreateDraft = {
  name: '',
  type: 'circular',
  color: '#3B82F6',
  radius_m: 500,
  alert_on_enter: true,
  alert_on_exit: true,
  vehicleScope: 'all',
  selectedVehicleIds: [],
}

export default function GeofencesPage() {
  const { canWriteFleet } = usePermissions()
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFence, setEditFence] = useState<Geofence | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<GeofenceCreateDraft>(DEFAULT_DRAFT)
  const [drawCenter, setDrawCenter] = useState<google.maps.LatLngLiteral | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<google.maps.LatLngLiteral[]>([])
  const [createError, setCreateError] = useState('')
  const [createSaving, setCreateSaving] = useState(false)

  async function loadGeofences() {
    const res = await fetch('/api/geofences')
    const data = await res.json()
    setGeofences(data.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadGeofences() }, [])

  const startCreate = useCallback(() => {
    if (!canWriteFleet) return
    setCreating(true)
    setDraft(DEFAULT_DRAFT)
    setDrawCenter(null)
    setPolygonPoints([])
    setCreateError('')
    setListOpen(false)
  }, [canWriteFleet])

  useEffect(() => {
    const openModal = () => startCreate()
    window.addEventListener('open-geofence-modal', openModal)
    return () => window.removeEventListener('open-geofence-modal', openModal)
  }, [startCreate])

  function cancelCreate() {
    setCreating(false)
    setDrawCenter(null)
    setPolygonPoints([])
    setCreateError('')
    setDraft(DEFAULT_DRAFT)
  }

  function resetDrawing() {
    setDrawCenter(null)
    setPolygonPoints([])
    setCreateError('')
  }

  function handleDraftChange(patch: Partial<GeofenceCreateDraft>) {
    setDraft(prev => {
      const next = { ...prev, ...patch }
      if (patch.type && patch.type !== prev.type) {
        setDrawCenter(null)
        setPolygonPoints([])
      }
      return next
    })
  }

  const handleMapClick = useCallback((pos: google.maps.LatLngLiteral) => {
    if (!creating) return
    if (draft.type === 'circular') {
      setDrawCenter(pos)
    } else {
      setPolygonPoints(prev => [...prev, pos])
    }
  }, [creating, draft.type])

  const drawHint =
    draft.type === 'circular'
      ? drawCenter
        ? 'Ajusta el radio y guarda la geocerca'
        : 'Toca el mapa para colocar el centro'
      : polygonPoints.length < 3
        ? `Toca el mapa para añadir vértices (${polygonPoints.length}/3 mín.)`
        : 'Polígono listo — puedes guardar o resetear'

  const canSaveCreate =
    draft.name.trim().length > 0 &&
    (draft.type === 'circular'
      ? drawCenter !== null
      : polygonPoints.length >= 3) &&
    (draft.vehicleScope === 'all' || draft.selectedVehicleIds.length > 0)

  async function saveCreate() {
    if (!canSaveCreate) return
    setCreateSaving(true)
    setCreateError('')
    try {
      const geometry =
        draft.type === 'circular' && drawCenter
          ? { type: 'Point', coordinates: [drawCenter.lng, drawCenter.lat] }
          : buildPolygonGeometry(polygonPoints)

      if (!geometry) {
        setCreateError('Dibuja la geocerca en el mapa antes de guardar')
        return
      }

      const vehicle_ids = draft.vehicleScope === 'all' ? null : draft.selectedVehicleIds

      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          type: draft.type,
          color: draft.color,
          alert_on_enter: draft.alert_on_enter,
          alert_on_exit: draft.alert_on_exit,
          radius_m: draft.type === 'circular' ? draft.radius_m : null,
          geometry,
          vehicle_ids,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      cancelCreate()
      await loadGeofences()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setCreateSaving(false)
    }
  }

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
    <div className="p-3 sm:p-4 h-full flex flex-col">
      <div className={`flex-1 flex flex-col min-h-0 ${creating ? 'lg:grid lg:grid-cols-3 gap-3 sm:gap-4' : 'lg:grid lg:grid-cols-3 gap-3 sm:gap-4'}`}>
        {/* Mapa */}
        <div className={`relative rounded-2xl overflow-hidden border border-gray-200 min-h-[calc(100dvh-14rem)] sm:min-h-[58vh] lg:min-h-[72vh] ${
          creating ? 'order-1 lg:col-span-2' : 'order-1 lg:order-2 lg:col-span-2'
        }`}>
          {creating && (
            <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none">
              <div className="bg-gray-900/85 backdrop-blur text-white text-xs sm:text-sm px-3 py-2 rounded-xl shadow-lg inline-block max-w-full">
                {drawHint}
              </div>
            </div>
          )}

          <APIProvider apiKey={API_KEY}>
            <Map
              defaultCenter={MEXICO_GEO_CENTER}
              defaultZoom={MEXICO_DEFAULT_ZOOM}
              mapId="geofences-map"
              mapTypeId="hybrid"
              mapTypeControl
              mapTypeControlOptions={{ mapTypeIds: ['hybrid', 'satellite', 'roadmap'] }}
              styles={[...FLEET_MAP_STYLES]}
              gestureHandling="greedy"
              className="w-full h-full"
              style={{ width: '100%', height: '100%', minHeight: 280 }}
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
                }
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
              })}

              {creating && (
                <GeofenceDrawLayer
                  enabled
                  drawType={draft.type}
                  color={draft.color}
                  radiusM={draft.radius_m}
                  center={drawCenter}
                  polygonPoints={polygonPoints}
                  onMapClick={handleMapClick}
                />
              )}
            </Map>
          </APIProvider>
        </div>

        {/* Panel derecho: lista o editor de creación */}
        <div className={`flex flex-col min-h-0 ${creating ? 'order-2 lg:col-span-1' : 'order-2 lg:order-1 lg:col-span-1'}`}>
          {creating ? (
            <GeofenceCreatePanel
              draft={draft}
              onChange={handleDraftChange}
              onReset={resetDrawing}
              onCancel={cancelCreate}
              onSave={() => void saveCreate()}
              saving={createSaving}
              error={createError}
              canSave={canSaveCreate}
              hint={drawHint}
              pointCount={polygonPoints.length}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <div className="hidden lg:block">
                  <h1 className="text-xl font-semibold text-gray-900">Geocercas</h1>
                  <p className="text-sm text-gray-500">{geofences.length} zonas configuradas</p>
                </div>
                {canWriteFleet && (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="lg:ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva geocerca
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setListOpen(v => !v)}
                className="lg:hidden flex items-center justify-between w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-left mb-2"
              >
                <div>
                  <span className="font-semibold text-gray-900">Geocercas</span>
                  <span className="text-sm text-gray-500 ml-2">({geofences.length})</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">{listOpen ? 'Ocultar' : 'Ver lista'}</span>
              </button>

              <div className={`lg:flex flex-col overflow-y-auto space-y-2 ${listOpen ? 'flex max-h-[40vh]' : 'hidden lg:flex'}`}>
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : geofences.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                    <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">No hay geocercas configuradas</p>
                    {canWriteFleet && (
                      <button
                        type="button"
                        onClick={startCreate}
                        className="text-sm text-blue-600 font-medium hover:underline"
                      >
                        Dibujar la primera en el mapa
                      </button>
                    )}
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
                          {fence.type === 'circular' ? `Circular · ${fence.radius_m}m` : 'Polígono'}
                        </div>
                        <div className="flex gap-2 mt-1.5 text-xs flex-wrap">
                          {fence.alert_on_enter && <span className="text-blue-600">Entrada</span>}
                          {fence.alert_on_exit && <span className="text-orange-600">Salida</span>}
                          <span className="text-gray-400">
                            · {!fence.vehicle_ids?.length ? 'Toda la flota' : `${fence.vehicle_ids.length} vehículo(s)`}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {canWriteFleet && (
                          <>
                            <button onClick={e => { e.stopPropagation(); void toggleActive(fence) }} className="text-gray-400 hover:text-blue-600">
                              {fence.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            <div className="flex gap-1">
                              <button onClick={e => { e.stopPropagation(); setEditFence(fence); setShowEditModal(true) }}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={e => { e.stopPropagation(); void deleteFence(fence.id) }}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showEditModal && editFence && canWriteFleet && (
        <GeofenceEditModal
          fence={editFence}
          onClose={() => { setShowEditModal(false); setEditFence(null) }}
          onSave={() => { setShowEditModal(false); setEditFence(null); void loadGeofences() }}
        />
      )}
    </div>
  )
}

function GeofenceEditModal({ fence, onClose, onSave }: { fence: Geofence; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [vehicleScope, setVehicleScope] = useState<'all' | 'selected'>(
    fence.vehicle_ids?.length ? 'selected' : 'all'
  )
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(fence.vehicle_ids ?? [])
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [form, setForm] = useState({
    name: fence.name,
    color: fence.color,
    alert_on_enter: fence.alert_on_enter,
    alert_on_exit: fence.alert_on_exit,
  })
  const set = (f: string, v: string | boolean) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => {
    fetch('/api/vehicles?per_page=200')
      .then(r => r.json())
      .then(d => setVehicles(d.data ?? []))
      .catch(() => {})
  }, [])

  const filteredVehicles = vehicles.filter(v => {
    const q = vehicleSearch.toLowerCase()
    if (!q) return true
    return v.economic_num.toLowerCase().includes(q) || v.plates.toLowerCase().includes(q)
  })

  function toggleVehicle(id: string) {
    setSelectedVehicleIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (vehicleScope === 'selected' && selectedVehicleIds.length === 0) {
      setError('Selecciona al menos un vehículo o elige "Toda la flota"')
      return
    }
    setLoading(true); setError('')
    try {
      const vehicle_ids = vehicleScope === 'all' ? null : selectedVehicleIds
      const res = await fetch(`/api/geofences/${fence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          color: form.color,
          alert_on_enter: form.alert_on_enter,
          alert_on_exit: form.alert_on_exit,
          vehicle_ids,
        }),
      })
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
          <h2 className="text-lg font-semibold">Editar geocerca</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            La forma ({fence.type === 'circular' ? 'circular' : 'polígono'}) no se puede redibujar aquí. Crea una nueva geocerca para cambiar la zona.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
            <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
              className="w-full h-10 border border-gray-300 rounded-xl px-2 cursor-pointer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['alert_on_enter', 'Alertar en entrada'], ['alert_on_exit', 'Alertar en salida']].map(([f, l]) => (
              <label key={f} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form[f as keyof typeof form] as boolean}
                  onChange={e => set(f, e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700">{l}</span>
              </label>
            ))}
          </div>
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Aplicar geocerca a</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setVehicleScope('all')}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
                  vehicleScope === 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>Toda la flota</button>
              <button type="button" onClick={() => setVehicleScope('selected')}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
                  vehicleScope === 'selected' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>Vehículos seleccionados</button>
            </div>
            {vehicleScope === 'selected' && (
              <div className="space-y-2">
                <input value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)}
                  placeholder="Buscar por económico o placas..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {filteredVehicles.map(v => (
                    <label key={v.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedVehicleIds.includes(v.id)}
                        onChange={() => toggleVehicle(v.id)} className="rounded" />
                      <span className="font-medium text-gray-800">{v.economic_num}</span>
                      <span className="text-gray-400 text-xs">{v.plates}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
