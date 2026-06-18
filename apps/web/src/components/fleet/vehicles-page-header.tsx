'use client'

import { Plus } from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'

interface Props {
  count: number
  onAdd: () => void
}

export function VehiclesPageHeader({ count, onAdd }: Props) {
  const { canWriteFleet } = usePermissions()

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Vehículos</h1>
        <p className="text-sm text-gray-500 mt-1">{count} vehículos registrados</p>
      </div>
      {canWriteFleet && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Agregar vehículo
        </button>
      )}
    </div>
  )
}
