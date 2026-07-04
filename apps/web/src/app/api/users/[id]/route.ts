import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { setUserGroupAccess } from '@/lib/auth/group-access'
import { writeAuditLog } from '@/lib/security/server-guards'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  role:      z.enum(['super_admin', 'admin_empresa', 'supervisor', 'operador', 'cliente_consulta', 'miembro_familiar']).optional(),
  is_active: z.boolean().optional(),
  company_id: z.string().uuid().nullable().optional(),
  group_ids: z.array(z.string().uuid()).optional(),
})

const MANAGEABLE_ROLES = ['super_admin', 'admin_empresa'] as const

async function getActor(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data } = await supabase.from('users').select('id, company_id, role').eq('id', userId).single()
  return data
}

async function getTarget(service: ReturnType<typeof createSupabaseServiceClient>, targetId: string) {
  const { data } = await service.from('users').select('id, company_id, role, email').eq('id', targetId).single()
  return data
}

function canManage(actor: { role: string; company_id: string | null }, target: { company_id: string | null }) {
  if (actor.role === 'super_admin') return true
  if (actor.role === 'admin_empresa') {
    return target.company_id === actor.company_id
  }
  return false
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actor = await getActor(supabase, user.id)
  if (!actor || !MANAGEABLE_ROLES.includes(actor.role as typeof MANAGEABLE_ROLES[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  const service = createSupabaseServiceClient()
  const target = await getTarget(service, params.id)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!canManage(actor, target)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === user.id && parsed.data.is_active === false) {
    return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 422 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active
  if (parsed.data.role !== undefined) {
    if (actor.role !== 'super_admin' && parsed.data.role === 'super_admin') {
      return NextResponse.json({ error: 'No puedes asignar rol Super Admin' }, { status: 403 })
    }
    if (actor.role !== 'super_admin' && parsed.data.role === 'admin_empresa') {
      return NextResponse.json({ error: 'No puedes asignar rol Admin Empresa' }, { status: 403 })
    }
    updates.role = parsed.data.role
    if (parsed.data.role === 'super_admin') updates.company_id = null
  }
  if (parsed.data.company_id !== undefined && actor.role === 'super_admin') {
    updates.company_id = parsed.data.company_id
  }

  if (!Object.keys(updates).length && parsed.data.group_ids === undefined) {
    return NextResponse.json({ error: 'No changes' }, { status: 422 })
  }

  if (Object.keys(updates).length) {
    const { error } = await service.from('users').update(updates).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (parsed.data.group_ids !== undefined) {
    const companyId = (updates.company_id as string | null | undefined) ?? target.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario sin empresa — no se pueden asignar grupos' }, { status: 422 })
    }
    await setUserGroupAccess(service, params.id, companyId, parsed.data.group_ids)
  }

  const { data: refreshed } = await service
    .from('users')
    .select('id, full_name, email, role, is_active, company_id')
    .eq('id', params.id)
    .single()

  await writeAuditLog(service, {
    companyId: refreshed?.company_id ?? target.company_id,
    userId: user.id,
    action: 'user.update',
    tableName: 'users',
    recordId: params.id,
    oldValues: target,
    newValues: { ...updates, group_ids: parsed.data.group_ids },
    request,
  })

  return NextResponse.json({ data: refreshed })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (params.id === user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 422 })
  }

  const actor = await getActor(supabase, user.id)
  if (!actor || !MANAGEABLE_ROLES.includes(actor.role as typeof MANAGEABLE_ROLES[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createSupabaseServiceClient()
  const target = await getTarget(service, params.id)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!canManage(actor, target)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await service.from('users').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(service, {
    companyId: target.company_id,
    userId: user.id,
    action: 'user.deactivate',
    tableName: 'users',
    recordId: params.id,
    oldValues: target,
    newValues: { is_active: false },
    request,
  })

  return NextResponse.json({ success: true })
}
