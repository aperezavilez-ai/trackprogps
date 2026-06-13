import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateDriverSchema = z.object({
  full_name:   z.string().min(2).max(150).optional(),
  phone:       z.string().max(20).nullable().optional(),
  email:       z.string().email().nullable().optional(),
  license_num: z.string().min(3).max(30).optional(),
  license_exp: z.string().optional(),
  is_active:   z.boolean().optional(),
  notes:       z.string().max(500).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = UpdateDriverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('drivers')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Soft delete
  const { error } = await supabase
    .from('drivers')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Unassign from vehicles
  await supabase.from('vehicles').update({ driver_id: null }).eq('driver_id', params.id)

  return NextResponse.json({ success: true })
}
