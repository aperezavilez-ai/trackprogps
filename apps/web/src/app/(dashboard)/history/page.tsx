import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RouteHistoryMap } from '@/components/map/route-history-map'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { vehicle_id?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/login')

  // Fetch vehicles for the selector
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, economic_num, plates, brand, model')
    .eq('company_id', profile.company_id)
    .is('deleted_at', null)
    .order('economic_num')

  const selectedVehicle = vehicles?.find(v => v.id === searchParams.vehicle_id)
  const apiKey = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? ''

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Historial de rutas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consulta y reproduce el recorrido de cualquier vehículo
          </p>
        </div>
      </div>

      {/* Vehicle selector */}
      <div className="flex gap-3 mb-4 flex-shrink-0">
        <form method="GET" className="flex gap-3 flex-wrap items-center">
          <select
            name="vehicle_id"
            defaultValue={searchParams.vehicle_id ?? ''}
            className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-52"
          >
            <option value="">Seleccionar vehículo</option>
            {(vehicles ?? []).map(v => (
              <option key={v.id} value={v.id}>
                {v.economic_num} — {v.plates} ({v.brand} {v.model})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            Seleccionar
          </button>
        </form>
      </div>

      {/* Route history map */}
      <div className="flex-1 min-h-0">
        {selectedVehicle ? (
          <RouteHistoryMap
            vehicleId={selectedVehicle.id}
            vehicleName={`${selectedVehicle.economic_num} (${selectedVehicle.plates})`}
            apiKey={apiKey}
          />
        ) : (
          <div className="h-full bg-white border border-gray-200 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-gray-500 text-sm">Selecciona un vehículo para ver su historial de rutas</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
