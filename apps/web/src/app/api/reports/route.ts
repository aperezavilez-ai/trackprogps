import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/scope'
import { assertPlanFeature } from '@/lib/billing/plan-guard'
import { reportResponse } from '@/lib/reports/export-report'
import { firstOrNull } from '@/lib/supabase/normalize'

type KmStats = { vehicle_id: string; km_total: number; max_speed: number; avg_speed: number }
type IdleStats = { vehicle_id: string; idle_minutes: number; idle_samples: number }
type ReportVehicleRelation = {
  economic_num: string
  plates: string
  driver: { full_name: string } | { full_name: string }[] | null
  company: { name: string } | { name: string }[] | null
}

async function resolveVehicleIds(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  opts: {
    profileCompanyId: string | null
    filterCompanyId: string | null
    driverId: string | null
    vehicleId: string | null
    superAdmin: boolean
  }
): Promise<{ vehicleIds: string[] | null; error?: string }> {
  const { profileCompanyId, filterCompanyId, driverId, vehicleId, superAdmin } = opts

  if (vehicleId) {
    let check = supabase.from('vehicles').select('id, company_id').eq('id', vehicleId).is('deleted_at', null).single()
    const { data: v, error } = await check
    if (error || !v) return { vehicleIds: [], error: 'Vehículo no encontrado' }
    if (!superAdmin && profileCompanyId && v.company_id !== profileCompanyId) {
      return { vehicleIds: [], error: 'Sin acceso a este vehículo' }
    }
    if (filterCompanyId && v.company_id !== filterCompanyId) return { vehicleIds: [] }
    return { vehicleIds: [vehicleId] }
  }

  let vehiclesQuery = supabase.from('vehicles').select('id').is('deleted_at', null)

  if (!superAdmin && profileCompanyId) {
    vehiclesQuery = vehiclesQuery.eq('company_id', profileCompanyId)
  } else if (filterCompanyId) {
    vehiclesQuery = vehiclesQuery.eq('company_id', filterCompanyId)
  }

  if (driverId) vehiclesQuery = vehiclesQuery.eq('driver_id', driverId)

  const { data: vehicles, error } = await vehiclesQuery
  if (error) return { vehicleIds: null, error: error.message }

  const ids = (vehicles ?? []).map(v => v.id)
  return { vehicleIds: ids }
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type         = searchParams.get('type') ?? 'kilometrage'
  const dateFrom     = searchParams.get('date_from')
  const dateTo       = searchParams.get('date_to')
  const format       = searchParams.get('format') ?? 'csv'
  const filterCompany = searchParams.get('company_id')
  const driverId     = searchParams.get('driver_id')
  const vehicleId    = searchParams.get('vehicle_id')

  if (!dateFrom || !dateTo) return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 422 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (profile.company_id) {
    const planGate = await assertPlanFeature(supabase, profile.company_id, profile.role, 'reports')
    if (planGate) return planGate
  }

  const superAdmin = isSuperAdmin(profile)
  const companyId  = superAdmin ? (filterCompany || null) : profile.company_id

  const { vehicleIds, error: scopeError } = await resolveVehicleIds(supabase, {
    profileCompanyId: profile.company_id,
    filterCompanyId: filterCompany,
    driverId,
    vehicleId,
    superAdmin,
  })
  if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 })
  const suffix = driverId ? '-cliente' : vehicleId ? '-vehiculo' : filterCompany ? '-empresa' : ''

  if (vehicleIds && vehicleIds.length === 0) {
    if (format === 'json') return NextResponse.json({ data: [], headers: [], count: 0 })
    const emptyHeaders = ['Sin datos']
    return reportResponse(format, type, dateFrom, dateTo, suffix, emptyHeaders, [['Sin datos para los filtros seleccionados']])
  }

  let csvRows: string[][] = []
  let headers: string[]  = []

  switch (type) {
    case 'kilometrage': {
      let vehiclesQuery = supabase
        .from('vehicles')
        .select('id, economic_num, plates, brand, model, driver:drivers(full_name), company:companies(name)')
        .is('deleted_at', null)
      if (companyId) vehiclesQuery = vehiclesQuery.eq('company_id', companyId)
      if (driverId) vehiclesQuery = vehiclesQuery.eq('driver_id', driverId)
      if (vehicleId) vehiclesQuery = vehiclesQuery.eq('id', vehicleId)
      const { data: vehicles } = await vehiclesQuery

      headers = ['Empresa', 'Cliente', 'Económico', 'Placas', 'Vehículo', 'Km recorridos', 'Velocidad máx', 'Velocidad prom']

      const vehicleList = vehicles ?? []
      const ids = vehicleList.map(v => v.id)

      if (ids.length > 0) {
        const { data: stats } = await supabase.rpc('get_km_stats_for_vehicles', {
          p_vehicle_ids: ids,
          p_from: new Date(dateFrom).toISOString(),
          p_to: new Date(dateTo + 'T23:59:59').toISOString(),
        })

        const statsMap = new Map(
          ((stats ?? []) as KmStats[]).map((s) => [s.vehicle_id, s]),
        )

        for (const v of vehicleList) {
          const s = statsMap.get(v.id)
          if (!s || s.km_total === 0 && s.max_speed === 0) continue

          const driver  = firstOrNull(v.driver as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Sin asignar'
          const company = firstOrNull(v.company as { name: string } | { name: string }[] | null)?.name ?? ''

          csvRows.push([
            company, driver,
            v.economic_num, v.plates,
            `${v.brand} ${v.model}`,
            Number(s.km_total).toFixed(1),
            Number(s.max_speed).toFixed(0),
            Number(s.avg_speed).toFixed(0),
          ])
        }
      }
      break
    }

    case 'speed': {
      let alertsQuery = supabase
        .from('alerts')
        .select('created_at, vehicle:vehicles(economic_num, plates, driver:drivers(full_name), company:companies(name)), speed, lat, lng, message')
        .eq('type', 'speed_excess')
        .gte('created_at', new Date(dateFrom).toISOString())
        .lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false })
      if (companyId) alertsQuery = alertsQuery.eq('company_id', companyId)
      if (vehicleIds) alertsQuery = alertsQuery.in('vehicle_id', vehicleIds)
      const { data: alerts } = await alertsQuery

      headers = ['Fecha y hora', 'Empresa', 'Cliente', 'Económico', 'Placas', 'Velocidad (km/h)', 'Latitud', 'Longitud', 'Descripción']
      for (const a of alerts ?? []) {
        const v = firstOrNull(a.vehicle as ReportVehicleRelation | ReportVehicleRelation[] | null)
        const driver = firstOrNull(v?.driver)
        const company = firstOrNull(v?.company)
        csvRows.push([
          new Date(a.created_at).toLocaleString('es-MX'),
          company?.name ?? '',
          driver?.full_name ?? 'Sin asignar',
          v?.economic_num ?? '', v?.plates ?? '',
          String(a.speed ?? ''),
          String(a.lat ?? ''), String(a.lng ?? ''),
          a.message,
        ])
      }
      break
    }

    case 'alerts': {
      let alertsQuery = supabase
        .from('alerts')
        .select('created_at, type, severity, title, message, vehicle:vehicles(economic_num, plates, driver:drivers(full_name), company:companies(name)), acknowledged_at')
        .gte('created_at', new Date(dateFrom).toISOString())
        .lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false })
      if (companyId) alertsQuery = alertsQuery.eq('company_id', companyId)
      if (vehicleIds) alertsQuery = alertsQuery.in('vehicle_id', vehicleIds)
      const { data: alerts } = await alertsQuery

      headers = ['Fecha', 'Empresa', 'Cliente', 'Tipo', 'Severidad', 'Económico', 'Placas', 'Descripción', 'Reconocida']
      for (const a of alerts ?? []) {
        const v = firstOrNull(a.vehicle as ReportVehicleRelation | ReportVehicleRelation[] | null)
        const driver = firstOrNull(v?.driver)
        const company = firstOrNull(v?.company)
        csvRows.push([
          new Date(a.created_at).toLocaleString('es-MX'),
          company?.name ?? '',
          driver?.full_name ?? 'Sin asignar',
          a.type, a.severity,
          v?.economic_num ?? '', v?.plates ?? '',
          a.message,
          a.acknowledged_at ? 'Sí' : 'No',
        ])
      }
      break
    }

    case 'trips': {
      let tripsQuery = supabase
        .from('trips')
        .select(`
          started_at, ended_at, start_lat, start_lng, end_lat, end_lng,
          distance_km, duration_min, avg_speed, max_speed, is_complete,
          vehicle:vehicles(economic_num, plates, driver:drivers(full_name), company:companies(name))
        `)
        .gte('started_at', new Date(dateFrom).toISOString())
        .lte('started_at', new Date(dateTo + 'T23:59:59').toISOString())
        .order('started_at', { ascending: false })
      if (companyId) tripsQuery = tripsQuery.eq('company_id', companyId)
      if (vehicleIds) tripsQuery = tripsQuery.in('vehicle_id', vehicleIds)
      const { data: trips } = await tripsQuery

      headers = ['Inicio', 'Fin', 'Empresa', 'Cliente', 'Económico', 'Placas', 'Distancia (km)', 'Duración (min)', 'Vel. prom', 'Vel. máx', 'Completo']
      for (const t of trips ?? []) {
        const v = firstOrNull(t.vehicle as ReportVehicleRelation | ReportVehicleRelation[] | null)
        const driver = firstOrNull(v?.driver)
        const company = firstOrNull(v?.company)
        csvRows.push([
          new Date(t.started_at).toLocaleString('es-MX'),
          t.ended_at ? new Date(t.ended_at).toLocaleString('es-MX') : 'En curso',
          company?.name ?? '',
          driver?.full_name ?? 'Sin asignar',
          v?.economic_num ?? '', v?.plates ?? '',
          Number(t.distance_km).toFixed(1),
          String(t.duration_min),
          t.avg_speed != null ? Number(t.avg_speed).toFixed(0) : '',
          t.max_speed != null ? Number(t.max_speed).toFixed(0) : '',
          t.is_complete ? 'Sí' : 'No',
        ])
      }
      break
    }

    case 'idle': {
      let vehiclesQuery = supabase
        .from('vehicles')
        .select('id, economic_num, plates, brand, model, driver:drivers(full_name), company:companies(name)')
        .is('deleted_at', null)
      if (companyId) vehiclesQuery = vehiclesQuery.eq('company_id', companyId)
      if (driverId) vehiclesQuery = vehiclesQuery.eq('driver_id', driverId)
      if (vehicleId) vehiclesQuery = vehiclesQuery.eq('id', vehicleId)
      else if (vehicleIds) vehiclesQuery = vehiclesQuery.in('id', vehicleIds)
      const { data: vehicleList } = await vehiclesQuery

      headers = ['Empresa', 'Cliente', 'Económico', 'Placas', 'Vehículo', 'Minutos ralentí (est.)', 'Muestras']
      const ids = (vehicleList ?? []).map(v => v.id)

      if (ids.length > 0) {
        const { data: stats } = await supabase.rpc('get_idle_stats_for_vehicles', {
          p_vehicle_ids: ids,
          p_from: new Date(dateFrom).toISOString(),
          p_to: new Date(dateTo + 'T23:59:59').toISOString(),
        })

        const statsMap = new Map(
          ((stats ?? []) as IdleStats[]).map((s) => [s.vehicle_id, s]),
        )

        for (const v of vehicleList ?? []) {
          const s = statsMap.get(v.id)
          if (!s) continue
          const driver  = firstOrNull(v.driver as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Sin asignar'
          const company = firstOrNull(v.company as { name: string } | { name: string }[] | null)?.name ?? ''
          csvRows.push([
            company, driver,
            v.economic_num, v.plates,
            `${v.brand} ${v.model}`,
            Number(s.idle_minutes).toFixed(1),
            String(s.idle_samples),
          ])
        }
      }
      break
    }

    default:
      return NextResponse.json({ error: 'Invalid report type' }, { status: 422 })
  }

  if (format === 'json') {
    return NextResponse.json({ data: csvRows, headers, count: csvRows.length })
  }

  return reportResponse(format, type, dateFrom, dateTo, suffix, headers, csvRows)
}
