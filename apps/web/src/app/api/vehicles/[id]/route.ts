import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { canAccessCompany, FLEET_WRITE_ROLES, getActorProfile, hasRole, writeAuditLog } from '@/lib/security/server-guards'

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
  group_id:     z.string().uuid().nullable().optional(),
  owner_name:   z.string().max(150).nullable().optional(),
  notes:        z.string().max(1000).nullable().optional(),
  fuel_efficiency_km_per_l: z.number().min(3).max(50).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actor = await getActorProfile(supabase, user.id)
  if (!hasRole(actor, FLEET_WRITE_ROLES)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { data: currentVehicle, error: currentVehicleError } = await supabase
    .from('vehicles')
    .select('id, company_id, driver_id, device_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (currentVehicleError || !currentVehicle) {
    return NextResponse.json({ error: currentVehicleError?.message ?? 'Vehicle not found' }, { status: 404 })
  }

  if (!canAccessCompany(actor!, currentVehicle.company_id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = UpdateVehicleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  if (parsed.data.device_id) {
    const { data: device } = await supabase
      .from('gps_devices')
      .select('id, company_id')
      .eq('id', parsed.data.device_id)
      .single()
    if (!device || device.company_id !== currentVehicle.company_id) {
      return NextResponse.json({ error: 'Dispositivo fuera de la empresa' }, { status: 422 })
    }
  }

  if (parsed.data.driver_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, company_id')
      .eq('id', parsed.data.driver_id)
      .single()
    if (!driver || driver.company_id !== currentVehicle.company_id) {
      return NextResponse.json({ error: 'Cliente/chofer fuera de la empresa' }, { status: 422 })
    }
  }

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
  await writeAuditLog(supabase, {
    companyId: currentVehicle.company_id,
    userId: user.id,
    action: 'vehicle.update',
    tableName: 'vehicles',
    recordId: params.id,
    oldValues: currentVehicle,
    newValues: parsed.data,
    request,
  })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actor = await getActorProfile(supabase, user.id)
  if (!hasRole(actor, FLEET_WRITE_ROLES)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { data: currentVehicle, error: currentVehicleError } = await supabase
    .from('vehicles')
    .select('id, company_id, driver_id, device_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (currentVehicleError || !currentVehicle) {
    return NextResponse.json({ error: currentVehicleError?.message ?? 'Vehicle not found' }, { status: 404 })
  }

  if (!canAccessCompany(actor!, currentVehicle.company_id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Soft delete
  const { error } = await supabase
    .from('vehicles')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog(supabase, {
    companyId: currentVehicle.company_id,
    userId: user.id,
    action: 'vehicle.delete',
    tableName: 'vehicles',
    recordId: params.id,
    oldValues: currentVehicle,
    request,
  })
  return NextResponse.json({ success: true })
}
