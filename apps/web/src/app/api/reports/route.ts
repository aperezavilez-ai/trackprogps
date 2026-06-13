import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type     = searchParams.get('type') ?? 'kilometrage'
  const dateFrom = searchParams.get('date_from')
  const dateTo   = searchParams.get('date_to')
  const format   = searchParams.get('format') ?? 'csv'

  if (!dateFrom || !dateTo) return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 422 })

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let csvRows: string[][] = []
  let headers: string[]  = []

  switch (type) {
    case 'kilometrage': {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, economic_num, plates, brand, model, driver:drivers(full_name)')
        .eq('company_id', profile.company_id)
        .is('deleted_at', null)

      headers = ['Económico', 'Placas', 'Vehículo', 'Conductor', 'Km recorridos', 'Velocidad máx', 'Velocidad prom']

      for (const v of vehicles ?? []) {
        const { data: positions } = await supabase
          .from('position_history')
          .select('speed, odometer, recorded_at')
          .eq('vehicle_id', v.id)
          .gte('recorded_at', new Date(dateFrom).toISOString())
          .lte('recorded_at', new Date(dateTo + 'T23:59:59').toISOString())
          .order('recorded_at')

        if (!positions?.length) continue

        const first = positions[0]!
        const last  = positions[positions.length - 1]!
        const kmDelta = Math.max(0, (last.odometer ?? 0) - (first.odometer ?? 0))
        const speeds  = positions.map(p => p.speed).filter(s => s > 0)
        const maxSpd  = speeds.length ? Math.max(...speeds) : 0
        const avgSpd  = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
        const driver  = (v.driver as { full_name: string } | null)?.full_name ?? 'Sin asignar'

        csvRows.push([
          v.economic_num, v.plates,
          `${v.brand} ${v.model}`,
          driver,
          kmDelta.toFixed(1),
          maxSpd.toFixed(0),
          avgSpd.toFixed(0),
        ])
      }
      break
    }

    case 'speed': {
      const { data: alerts } = await supabase
        .from('alerts')
        .select('created_at, vehicle:vehicles(economic_num, plates), speed, lat, lng, message')
        .eq('company_id', profile.company_id)
        .eq('type', 'speed_excess')
        .gte('created_at', new Date(dateFrom).toISOString())
        .lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false })

      headers = ['Fecha y hora', 'Económico', 'Placas', 'Velocidad (km/h)', 'Latitud', 'Longitud', 'Descripción']
      for (const a of alerts ?? []) {
        const v = a.vehicle as { economic_num: string; plates: string } | null
        csvRows.push([
          new Date(a.created_at).toLocaleString('es-MX'),
          v?.economic_num ?? '', v?.plates ?? '',
          String(a.speed ?? ''),
          String(a.lat ?? ''), String(a.lng ?? ''),
          a.message,
        ])
      }
      break
    }

    case 'alerts': {
      const { data: alerts } = await supabase
        .from('alerts')
        .select('created_at, type, severity, title, message, vehicle:vehicles(economic_num, plates), acknowledged_at')
        .eq('company_id', profile.company_id)
        .gte('created_at', new Date(dateFrom).toISOString())
        .lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false })

      headers = ['Fecha', 'Tipo', 'Severidad', 'Económico', 'Placas', 'Descripción', 'Reconocida']
      for (const a of alerts ?? []) {
        const v = a.vehicle as { economic_num: string; plates: string } | null
        csvRows.push([
          new Date(a.created_at).toLocaleString('es-MX'),
          a.type, a.severity,
          v?.economic_num ?? '', v?.plates ?? '',
          a.message,
          a.acknowledged_at ? 'Sí' : 'No',
        ])
      }
      break
    }

    default:
      return NextResponse.json({ error: 'Invalid report type' }, { status: 422 })
  }

  if (format === 'csv') {
    const csv = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const bom = '\uFEFF' // UTF-8 BOM for Excel
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte-${type}-${dateFrom}.csv"`,
      },
    })
  }

  return NextResponse.json({ data: csvRows, headers, count: csvRows.length })
}
