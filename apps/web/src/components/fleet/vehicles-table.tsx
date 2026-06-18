'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, MoreVertical, Wifi, WifiOff, Zap, ZapOff, Pencil, Trash2, MapPin } from 'lucide-react'
import { VehicleFormModal } from './vehicle-form-modal'
import { usePermissions } from '@/lib/context/permissions-context'

interface Vehicle {
  id: string
  economic_num: string
  plates: string
  brand: string
  model: string
  year: number
  type: string
  color: string | null
  status: string
  max_speed: number
  owner_name?: string | null
  group?: { id: string; name: string; color: string } | null
  device: { id: string; imei: string; model: string; status: string; last_seen: string | null } | null
  driver: { id: string; full_name: string; phone: string | null } | null
  position: { lat: number; lng: number; speed: number; ignition: boolean; recorded_at: string } | null
}

interface Props {
  vehicles: Vehicle[]
  groups?: { id: string; name: string; color: string }[]
  count: number
  page: number
  perPage: number
  search: string
  status: string
  group?: string
  showModal?: boolean
  onCloseModal?: () => void
}

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-green-50 text-green-700 border-green-200',
  inactive:    'bg-gray-50 text-gray-600 border-gray-200',
  maintenance: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

const STATUS_LABELS: Record<string, string> = {
  active:      'Activo',
  inactive:    'Inactivo',
  maintenance: 'Mantenimiento',
}

export function VehiclesTable({ vehicles, groups = [], count, page, perPage, search, status, group = '', showModal: externalShow, onCloseModal }: Props) {
  const router = useRouter()
  const { canWriteFleet } = usePermissions()
  const [searchValue, setSearchValue] = useState(search)
  const [showModal, setShowModal] = useState(false)
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.ceil(count / perPage)

  function applySearch(s: string) {
    const params = new URLSearchParams()
    if (s) params.set('search', s)
    if (status) params.set('status', status)
    if (group) params.set('group', group)
    params.set('page', '1')
    startTransition(() => router.push(`/vehicles?${params}`))
  }

  function changePage(p: number) {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (group) params.set('group', group)
    params.set('page', String(p))
    router.push(`/vehicles?${params}`)
  }

  async function handleDelete(vehicleId: string) {
    if (!confirm('¿Desactivar este vehículo?')) return
    await fetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch(searchValue)}
            placeholder="Buscar por económico, placas, marca..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={group}
          onChange={e => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (status) params.set('status', status)
            if (e.target.value) params.set('group', e.target.value)
            router.push(`/vehicles?${params}`)
          }}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los grupos</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          onChange={e => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (group) params.set('group', group)
            if (e.target.value) params.set('status', e.target.value)
            router.push(`/vehicles?${params}`)
          }}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="maintenance">En mantenimiento</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo / Titular</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">GPS</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Chofer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Posición</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      🚛
                    </div>
                    <span className="text-sm">No se encontraron vehículos</span>
                    {canWriteFleet && (
                      <button onClick={() => setShowModal(true)}
                        className="text-blue-600 text-sm hover:underline mt-1">
                        Agregar el primero
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : vehicles.map(v => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                {/* Vehículo */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-lg">
                      {v.type === 'truck' ? '🚛' : v.type === 'van' ? '🚐' : v.type === 'motorcycle' ? '🏍️' : '🚗'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{v.economic_num}</div>
                      <div className="text-xs text-gray-500">{v.brand} {v.model} {v.year} · {v.plates}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {v.group && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
                      style={{ borderColor: v.group.color, color: v.group.color, backgroundColor: `${v.group.color}15` }}>
                      {v.group.name}
                    </span>
                  )}
                  {v.owner_name && (
                    <div className="text-xs text-gray-500 mt-1">{v.owner_name}</div>
                  )}
                  {!v.group && !v.owner_name && <span className="text-xs text-gray-400">—</span>}
                </td>
                {/* GPS */}
                <td className="px-4 py-3">
                  {v.device ? (
                    <div className="flex items-center gap-1.5">
                      {v.device.status === 'online'
                        ? <Wifi className="w-3.5 h-3.5 text-green-500" />
                        : <WifiOff className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="text-xs text-gray-600">{v.device.imei.slice(-6)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Sin GPS</span>
                  )}
                </td>
                {/* Chofer */}
                <td className="px-4 py-3">
                  {v.driver ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{v.driver.full_name}</div>
                      <div className="text-xs text-gray-500">{v.driver.phone ?? ''}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Sin asignar</span>
                  )}
                </td>
                {/* Estado */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[v.status] ?? ''}`}>
                    {STATUS_LABELS[v.status] ?? v.status}
                  </span>
                </td>
                {/* Posición actual */}
                <td className="px-4 py-3">
                  {v.position ? (
                    <div className="flex items-center gap-1.5">
                      {v.position.ignition
                        ? <Zap className="w-3.5 h-3.5 text-green-500" />
                        : <ZapOff className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="text-xs text-gray-600">
                        {v.position.speed > 2 ? `${Math.round(v.position.speed)} km/h` : 'Detenido'}
                      </span>
                    </div>
                  ) : <span className="text-xs text-gray-400">Sin datos</span>}
                </td>
                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {canWriteFleet ? (
                  <div className="relative inline-block">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === v.id ? null : v.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenId === v.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                          <button onClick={() => { setEditVehicle(v); setShowModal(true); setMenuOpenId(null) }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          {v.position && (
                            <a
                              href={`https://maps.google.com/?q=${v.position.lat},${v.position.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <MapPin className="w-3.5 h-3.5" /> Ver en mapa
                            </a>
                          )}
                          <div className="border-t border-gray-100" />
                          <button onClick={() => handleDelete(v.id)}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" /> Desactivar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  ) : v.position ? (
                    <a
                      href={`https://maps.google.com/?q=${v.position.lat},${v.position.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Mapa
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {(page - 1) * perPage + 1}–{Math.min(page * perPage, count)} de {count}
          </span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => changePage(page - 1)}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-40">
              Anterior
            </button>
            <button disabled={page === totalPages} onClick={() => changePage(page + 1)}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-40">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {canWriteFleet && (showModal || externalShow) && (
        <VehicleFormModal
          vehicle={editVehicle}
          onClose={() => {
            setShowModal(false)
            setEditVehicle(null)
            onCloseModal?.()
          }}
          onSave={() => {
            setShowModal(false)
            setEditVehicle(null)
            onCloseModal?.()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
