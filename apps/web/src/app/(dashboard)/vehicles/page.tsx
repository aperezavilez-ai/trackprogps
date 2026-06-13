import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { VehiclesTable } from '@/components/fleet/vehicles-table'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; status?: string }
}) {
  const supabase = createSupabaseServerClient()
  const page    = parseInt(searchParams.page ?? '1', 10)
  const search  = searchParams.search ?? ''
  const status  = searchParams.status ?? ''
  const perPage = 20
  const offset  = (page - 1) * perPage

  let query = supabase
    .from('vehicles')
    .select(`
      *,
      device:gps_devices(id, imei, model, status, last_seen),
      driver:drivers(id, full_name, phone),
      position:vehicle_positions(lat, lng, speed, ignition, recorded_at)
    `, { count: 'exact' })
    .is('deleted_at', null)
    .order('economic_num')
    .range(offset, offset + perPage - 1)

  if (search) query = query.or(`economic_num.ilike.%${search}%,plates.ilike.%${search}%,brand.ilike.%${search}%`)
  if (status) query = query.eq('status', status)

  const { data: vehicles, count } = await query

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vehículos</h1>
          <p className="text-sm text-gray-500 mt-1">{count ?? 0} vehículos registrados</p>
        </div>
        <button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          onClick={() => {/* handled client-side */}}
          id="btn-add-vehicle"
        >
          <Plus className="w-4 h-4" />
          Agregar vehículo
        </button>
      </div>

      <Suspense fallback={<div className="text-center py-12 text-gray-400">Cargando...</div>}>
        <VehiclesTable
          vehicles={vehicles ?? []}
          count={count ?? 0}
          page={page}
          perPage={perPage}
          search={search}
          status={status}
        />
      </Suspense>
    </div>
  )
}
