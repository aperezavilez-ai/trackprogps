import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateVehicleSchema = z.object({
  economic_num: z.string().min(1).max(20).optional(),
  plates:       z.string().min(1).max(15).optional(),
  brand:        z.string().min(1).max(60).optional(),
  model:        z.string().min(1).max(60).optional(),
  year:         z.number().int().min(1900).max(2100).optional(),
  type:         z.enum(['sedan','suv','pickup','van','truck','bus','motorcycle','other']).optional(),
  color:        z.string().max(30).nullable().optional(),
  max_speed:    z.number().int().min(60).max(300).optional(),
  status:       z.enum(['active','inactive','maintenance']).optional(),
  device_id:    z.string().uuid().nullable().optional(),
  driver_id:    z.string().uuid().nullable().optional(),
  notes:        z.string().max(1000).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateVehicleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  // If driver_id is changing, record history
  if (parsed.data.driver_id !== undefined) {
    const { data: current } = await supabase
      .from('vehicles')
      .select('driver_id, company_id')
      .eq('id', params.id)
      .single()

    if (current?.driver_id !== parsed.data.driver_id) {
      // Close previous assignment
      if (current?.driver_id) {
        await supabase
          .from('vehicle_driver_history')
          .update({ unassigned_at: new Date().toISOString() })
          .eq('vehicle_id', params.id)
          .eq('driver_id', current.driver_id)
          .is('unassigned_at', null)
      }
      // Open new assignment
      if (parsed.data.driver_id) {
        await supabase.from('vehicle_driver_history').insert({
          vehicle_id:  params.id,
          driver_id:   parsed.data.driver_id,
          company_id:  current?.company_id,
          assigned_by: user.id,
        })
      }
    }
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Soft delete
  const { error } = await supabase
    .from('vehicles')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
