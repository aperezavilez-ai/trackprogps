import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assertNotDemoTour } from '@/lib/api/demo-guard'
import { buildIlikeOr } from '@/lib/security/sanitize-search'
import { z } from 'zod'

const CreateVehicleSchema = z.object({
  economic_num: z.string().min(1).max(20),
  plates:       z.string().min(1).max(15),
  brand:        z.string().min(1).max(60),
  model:        z.string().min(1).max(60),
  year:         z.number().int().min(1900).max(2100),
  vin:          z.string().length(17).nullable().optional(),
  type:         z.enum(['sedan', 'suv', 'pickup', 'van', 'truck', 'bus', 'motorcycle', 'other']),
  color:        z.string().max(30).nullable().optional(),
  max_speed:    z.number().int().min(60).max(300).default(120),
  device_id:    z.string().uuid().nullable().optional(),
  driver_id:    z.string().uuid().nullable().optional(),
  group_id:     z.string().uuid().nullable().optional(),
  owner_name:   z.string().max(150).nullable().optional(),
  notes:        z.string().max(1000).nullable().optional(),
  fuel_efficiency_km_per_l: z.number().min(3).max(50).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page    = parseInt(searchParams.get('page')     ?? '1', 10)
  const perPage = parseInt(searchParams.get('per_page') ?? '20', 10)
  const search  = searchParams.get('search') ?? ''
  const status  = searchParams.get('status')

  const offset = (page - 1) * perPage

  let query = supabase
    .from('vehicles')
    .select(`
      *,
      device:gps_devices(id, imei, model, status, last_seen),
      driver:drivers(id, full_name, phone),
      group:vehicle_groups(id, name, color),
      position:vehicle_positions(lat, lng, speed, heading, ignition, recorded_at)
    `, { count: 'exact' })
    .is('deleted_at', null)
    .order('economic_num', { ascending: true })
    .range(offset, offset + perPage - 1)

  if (search) {
    const orFilter = buildIlikeOr(
      ['economic_num', 'plates', 'brand', 'model'],
      search,
    )
    if (orFilter) query = query.or(orFilter)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    count,
    page,
    per_page:    perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const demoBlock = await assertNotDemoTour(supabase)
  if (demoBlock) return demoBlock

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role
  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (!['super_admin', 'admin_empresa', 'supervisor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Parse and validate body
  const body = await request.json()
  const parsed = CreateVehicleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // Check plan limits (solo cupo flota GPS / hardware, no móviles)
  if (profile.role !== 'super_admin' && profile.company_id) {
    const { getCompanyUsage } = await import('@/lib/billing/plan-guard')
    const usage = await getCompanyUsage(supabase, profile.company_id)
    if (usage?.at_vehicle_limit) {
      return NextResponse.json(
        { error: `Plan limit reached (${usage.vehicles?.current ?? 0}/${usage.vehicles?.max ?? 0} vehículos GPS)` },
        { status: 402 },
      )
    }
  }

  let payload = { ...parsed.data, company_id: profile.company_id }

  if (!payload.group_id && profile.company_id) {
    const { data: defaultGroup } = await supabase
      .from('vehicle_groups')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('is_default', true)
      .maybeSingle()
    if (defaultGroup) payload.group_id = defaultGroup.id
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A vehicle with these plates or economic number already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log to audit
  await supabase.from('audit_logs').insert({
    company_id: profile.company_id,
    user_id:    user.id,
    action:     'vehicle.create',
    table_name: 'vehicles',
    record_id:  (data as { id: string }).id,
    new_values: data,
  })

  return NextResponse.json({ data }, { status: 201 })
}
