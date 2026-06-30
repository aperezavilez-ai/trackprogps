import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const companyIdSchema = z.string().uuid()

async function resolveInternalSandboxCompanyId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('email', 'interno@trackprogps.mx')
    .maybeSingle()
  return data?.id ?? null
}

export async function resolveTargetCompanyId(
  supabase: SupabaseClient,
  profile: { company_id: string | null; role: string },
  bodyCompanyId?: string | null,
): Promise<{ companyId: string } | NextResponse> {
  if (profile.company_id) {
    return { companyId: profile.company_id }
  }

  if (profile.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Usuario sin empresa asignada. Contacta al administrador.' },
      { status: 403 },
    )
  }

  if (!bodyCompanyId) {
    const sandboxId = await resolveInternalSandboxCompanyId(supabase)
    if (sandboxId) return { companyId: sandboxId }

    return NextResponse.json(
      { error: 'Selecciona la empresa a la que pertenece el dispositivo.' },
      { status: 422 },
    )
  }

  const parsed = companyIdSchema.safeParse(bodyCompanyId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'company_id inválido' }, { status: 422 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', parsed.data)
    .maybeSingle()

  if (!company) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  return { companyId: company.id }
}

export function planAllowsHardware(features: Record<string, unknown> | undefined, maxVehicles: number): boolean {
  if (maxVehicles <= 0) return features?.hardware_gps === true
  return maxVehicles > 0
}
