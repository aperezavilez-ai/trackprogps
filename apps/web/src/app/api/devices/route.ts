import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const DeviceSchema = z.object({
  imei:         z.string().length(15).regex(/^\d+$/, 'IMEI must be 15 digits'),
  model:        z.string().min(1).max(50).default('FMC920'),
  firmware_ver: z.string().max(20).nullable().optional(),
  sim_iccid:    z.string().max(30).nullable().optional(),
  phone_num:    z.string().max(20).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page    = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage = parseInt(searchParams.get('per_page') ?? '50', 10)
  const offset  = (page - 1) * perPage

  const { data, count, error } = await supabase
    .from('gps_devices')
    .select('*, vehicle:vehicles(economic_num, plates)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = DeviceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('gps_devices')
    .insert({ ...parsed.data, company_id: profile.company_id })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Device with this IMEI already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
