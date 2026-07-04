import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { canAccessCompany, FLEET_WRITE_ROLES, getActorProfile, hasRole, writeAuditLog } from '@/lib/security/server-guards'

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

  const actor = await getActorProfile(supabase, user.id)
  if (!hasRole(actor, FLEET_WRITE_ROLES)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { data: currentDriver, error: currentDriverError } = await supabase
    .from('drivers')
    .select('id, company_id, full_name, email, phone, license_num, is_active')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (currentDriverError || !currentDriver) {
    return NextResponse.json({ error: currentDriverError?.message ?? 'Driver not found' }, { status: 404 })
  }

  if (!canAccessCompany(actor!, currentDriver.company_id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = UpdateDriverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('drivers')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog(supabase, {
    companyId: currentDriver.company_id,
    userId: user.id,
    action: 'driver.update',
    tableName: 'drivers',
    recordId: params.id,
    oldValues: currentDriver,
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

  const { data: currentDriver, error: currentDriverError } = await supabase
    .from('drivers')
    .select('id, company_id, full_name, email, phone, license_num, is_active')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (currentDriverError || !currentDriver) {
    return NextResponse.json({ error: currentDriverError?.message ?? 'Driver not found' }, { status: 404 })
  }

  if (!canAccessCompany(actor!, currentDriver.company_id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Soft delete
  const { error } = await supabase
    .from('drivers')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Unassign from vehicles
  await supabase.from('vehicles').update({ driver_id: null }).eq('driver_id', params.id).eq('company_id', currentDriver.company_id)

  await writeAuditLog(supabase, {
    companyId: currentDriver.company_id,
    userId: user.id,
    action: 'driver.delete',
    tableName: 'drivers',
    recordId: params.id,
    oldValues: currentDriver,
    request,
  })

  return NextResponse.json({ success: true })
}
