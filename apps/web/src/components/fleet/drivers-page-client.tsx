'use client'

import Link from 'next/link'
import { Plus, UserPlus } from 'lucide-react'
import { DriversTable } from './drivers-table'
import { usePermissions } from '@/lib/context/permissions-context'
import type { DriverWithUnits } from '@/lib/fleet/driver-types'

interface Props {
  drivers: DriverWithUnits[]
  count: number
  page: number
  perPage: number
  search: string
}

export function DriversPageClient({ drivers, count, page, perPage, search }: Props) {
  const { canWriteFleet } = usePermissions()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">{count} clientes registrados</p>
        </div>
        {canWriteFleet && (
          <div className="flex gap-2">
            <Link
              href="/drivers/new"
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nueva instalación
            </Link>
            <button
              id="btn-add-driver"
              className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Solo cliente
            </button>
          </div>
        )}
      </div>
      <DriversTable drivers={drivers} count={count} page={page} perPage={perPage} search={search} />
    </div>
  )
}
