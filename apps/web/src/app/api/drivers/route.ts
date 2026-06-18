import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canWriteFleet } from '@/lib/auth/permissions'
import { z } from 'zod'

const DriverSchema = z.object({
  full_name:   z.string().min(2).max(150),
  phone:       z.string().max(20).nullable().optional(),
  email:       z.string().email().nullable().optional(),
  license_num: z.string().min(3).max(30),
  license_exp: z.string(),
  notes:       z.string().max(500).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const limit  = parseInt(searchParams.get('limit') ?? '20', 10)
  const offset = (page - 1) * limit

  let query = supabase
    .from('drivers')
    .select('*, vehicle:vehicles(economic_num, plates)', { count: 'exact' })
    .is('deleted_at', null)
    .order('full_name')
    .range(offset, offset + limit - 1)

  if (search) query = query.or(`full_name.ilike.%${search}%,license_num.ilike.%${search}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count, page, per_page: limit, total_pages: Math.ceil((count ?? 0) / limit) })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWriteFleet(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = DriverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('drivers')
    .insert({ ...parsed.data, company_id: profile.company_id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
