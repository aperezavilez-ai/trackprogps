import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  ArrowLeft, User, Phone, Mail, CreditCard, CheckCircle,
} from 'lucide-react'
import { ClientDetailClient } from '@/components/fleet/client-detail-client'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: driver } = await supabase
    .from('drivers')
    .select(`
      id, full_name, phone, email, license_num, license_exp, is_active, notes, created_at,
      company:companies(name),
      vehicles(
        id, economic_num, plates, brand, model, year, color, status, vin,
        device:gps_devices(id, imei, model, status, last_seen, phone_num, firmware_ver, sim_iccid)
      )
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (!driver) notFound()

  const vehicles = Array.isArray(driver.vehicles) ? driver.vehicles : driver.vehicles ? [driver.vehicles] : []
  const vehicleIds = vehicles.map(v => v.id as string)

  const units = await Promise.all(
    vehicles.map(async (v) => {
      const vehicle = v as {
        id: string; economic_num: string; plates: string; brand: string; model: string
        year: number; color: string | null; status: string; vin: string | null
        device: {
          id: string; imei: string; model: string; status: string; last_seen: string | null
          phone_num: string | null; firmware_ver: string | null; sim_iccid: string | null
        } | { id: string; imei: string; model: string; status: string; last_seen: string | null }[] | null
      }

      const dev = Array.isArray(vehicle.device) ? vehicle.device[0] : vehicle.device

      const { data: pos } = await supabase
        .from('vehicle_positions')
        .select('lat, lng, speed, ignition, recorded_at')
        .eq('vehicle_id', vehicle.id)
        .maybeSingle()

      return {
        id: vehicle.id,
        economic_num: vehicle.economic_num,
        plates: vehicle.plates,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        status: vehicle.status,
        device: dev ?? null,
        position: pos,
      }
    })
  )

  const { data: geofences } = await supabase
    .from('geofences')
    .select('id, name, color, is_active, vehicle_ids')
    .order('name')

  const companyRaw = driver.company
  const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { name: string } | null
  const showLicense = driver.license_num && driver.license_num !== 'N/A'
  const licenseDays = showLicense
    ? Math.ceil((new Date(driver.license_exp).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="p-6 max-w-5xl">
      <Link href="/drivers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-lg font-bold text-purple-700">
            {driver.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{driver.full_name}</h1>
            <p className="text-sm text-gray-500">{company?.name ?? 'Sin empresa'}</p>
          </div>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full font-medium border ${
          driver.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
        }`}>
          {driver.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Datos del cliente</h2>
          </div>
          <dl className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <div><dt className="text-gray-500">Teléfono</dt><dd className="font-medium">{driver.phone ?? '—'}</dd></div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <div><dt className="text-gray-500">Correo</dt><dd className="font-medium">{driver.email ?? '—'}</dd></div>
            </div>
            {showLicense && (
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <div>
                  <dt className="text-gray-500">Licencia</dt>
                  <dd className="font-medium font-mono">{driver.license_num}</dd>
                  {licenseDays !== null && (
                    <dd className={`text-xs ${licenseDays <= 0 ? 'text-red-600' : licenseDays <= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {licenseDays <= 0 ? 'Expirada' : `Vence ${new Date(driver.license_exp).toLocaleDateString('es-MX')}`}
                    </dd>
                  )}
                </div>
              </div>
            )}
            {driver.notes && (
              <div><dt className="text-gray-500 mb-1">Notas</dt><dd className="text-gray-700">{driver.notes}</dd></div>
            )}
            <div className="text-xs text-gray-400 pt-2 border-t flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Registrado: {new Date(driver.created_at).toLocaleDateString('es-MX')}
            </div>
          </dl>
        </div>

        <div className="lg:col-span-2">
          <ClientDetailClient
            driverId={driver.id}
            driverName={driver.full_name}
            units={units}
            geofences={geofences ?? []}
            vehicleIds={vehicleIds}
          />
        </div>
      </div>
    </div>
  )
}
