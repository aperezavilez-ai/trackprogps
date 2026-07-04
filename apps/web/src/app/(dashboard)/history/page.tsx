import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RouteHistoryMap } from '@/components/map/route-history-map'
import { scopeByCompany } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { vehicle_id?: string; lat?: string; lng?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  let vehiclesQuery = supabase
    .from('vehicles')
    .select('id, economic_num, plates, brand, model, company_id, owner_name, device:gps_devices(source_type, mobile_metadata)')
    .is('deleted_at', null)
    .order('economic_num')

  vehiclesQuery = scopeByCompany(vehiclesQuery, profile.company_id)

  const { data: vehicles } = await vehiclesQuery

  const selectedVehicle = vehicles?.find(v => v.id === searchParams.vehicle_id)
  const selectedDevice = selectedVehicle
    ? Array.isArray(selectedVehicle.device)
      ? selectedVehicle.device[0]
      : selectedVehicle.device
    : null
  const selectedIsMobile = selectedDevice?.source_type === 'mobile'
  const selectedOwner = readMobileOwnerName(selectedDevice?.mobile_metadata)
  const selectedName = selectedIsMobile
    ? `${selectedOwner ?? selectedVehicle?.economic_num ?? 'Movil'} (${selectedVehicle?.plates ?? 'TrackProGPS'})`
    : selectedVehicle
      ? `${selectedVehicle.economic_num} (${selectedVehicle.plates})`
      : ''
  const apiKey = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? ''
  const latParam = searchParams.lat ? Number(searchParams.lat) : null
  const lngParam = searchParams.lng ? Number(searchParams.lng) : null
  const queryCenter = (latParam != null && lngParam != null && Number.isFinite(latParam) && Number.isFinite(lngParam))
    ? { lat: latParam, lng: lngParam }
    : null

  const { data: livePos } = selectedVehicle
    ? await supabase
      .from('vehicle_positions')
      .select('lat, lng')
      .eq('vehicle_id', selectedVehicle.id)
      .maybeSingle()
    : { data: null }

  const initialCenter = queryCenter ?? (livePos ? { lat: livePos.lat, lng: livePos.lng } : undefined)

  return (
    <div className="p-3 sm:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 sm:mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Historial de rutas</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">
            Consulta y reproduce el recorrido de cualquier unidad móvil o vehículo
            {!profile.company_id && ' — vista de plataforma (todas las empresas)'}
          </p>
        </div>
      </div>

      {/* Unit selector — sticky en móvil */}
      <div className="sticky top-0 z-20 bg-gray-50 py-2 -mx-3 px-3 sm:static sm:mx-0 sm:px-0 sm:py-0 flex gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0 border-b sm:border-0 border-gray-200">
        <form method="GET" className="flex gap-2 sm:gap-3 flex-1 flex-wrap items-center">
          <select
            name="vehicle_id"
            defaultValue={searchParams.vehicle_id ?? ''}
            className="border border-gray-300 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 flex-1 min-w-0 sm:min-w-52"
          >
            <option value="">Seleccionar unidad</option>
            {(vehicles ?? []).map(v => (
              <option key={v.id} value={v.id}>
                {v.economic_num} — {v.plates} ({v.brand} {v.model})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-orange-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 whitespace-nowrap"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Route history map */}
      <div className="flex-1 min-h-[calc(100dvh-14rem)] sm:min-h-0">
        {selectedVehicle ? (
          <RouteHistoryMap
            vehicleId={selectedVehicle.id}
            vehicleName={selectedName}
            deviceSource={selectedIsMobile ? 'mobile' : 'hardware'}
            apiKey={apiKey}
            initialCenter={initialCenter}
          />
        ) : (
          <div className="h-full bg-white border border-gray-200 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-gray-500 text-sm">Selecciona una unidad para ver su historial de rutas</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function readMobileOwnerName(metadata: Record<string, unknown> | null | undefined) {
  const owner = metadata?.device_owner
  if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return null
  const name = (owner as { name?: unknown }).name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}
