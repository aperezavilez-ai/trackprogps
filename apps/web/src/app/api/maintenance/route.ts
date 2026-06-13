import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const MaintenanceSchema = z.object({
  vehicle_id:       z.string().uuid(),
  type:             z.enum(['oil_change','tire_rotation','brake_service','tune_up','insurance','verification','other']),
  description:      z.string().min(3).max(500),
  cost:             z.number().nullable().optional(),
  currency:         z.string().default('MXN'),
  odometer_at:      z.number().nullable().optional(),
  next_odometer:    z.number().nullable().optional(),
  service_date:     z.string(),
  next_service_date: z.string().nullable().optional(),
  workshop:         z.string().max(150).nullable().optional(),
  notes:            z.string().max(1000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage  = parseInt(searchParams.get('per_page') ?? '50', 10)
  const vehicleId = searchParams.get('vehicle_id')
  const offset   = (page - 1) * perPage

  let query = supabase
    .from('maintenance_records')
    .select('*, vehicle:vehicles(economic_num, plates)', { count: 'exact' })
    .order('service_date', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (vehicleId) query = query.eq('vehicle_id', vehicleId)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = MaintenanceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('maintenance_records')
    .insert({ ...parsed.data, company_id: profile.company_id, created_by: user.id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
