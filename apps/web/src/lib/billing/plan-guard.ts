import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { PlanFeatures } from '@gps-saas/types'

type UsageRow = {
  features?: PlanFeatures & Record<string, unknown>
  at_user_limit?: boolean
  at_vehicle_limit?: boolean
  at_mobile_limit?: boolean
  mobile_devices?: { current: number; max: number }
  vehicles?: { current: number; max: number }
  mobile_only_plan?: boolean
}

export async function getCompanyUsage(
  supabase: SupabaseClient,
  companyId: string,
): Promise<UsageRow | null> {
  const { data, error } = await supabase.rpc('get_company_usage', {
    p_company_id: companyId,
  })
  if (error || !data) return null
  return data as UsageRow
}

export async function assertPlanFeature(
  supabase: SupabaseClient,
  companyId: string | null,
  role: string,
  feature: keyof PlanFeatures | string,
): Promise<NextResponse | null> {
  if (role === 'super_admin' || !companyId) return null

  const usage = await getCompanyUsage(supabase, companyId)
  const val = usage?.features?.[feature as keyof PlanFeatures]
  const enabled = val === true || (typeof val === 'number' && val > 0)

  if (!enabled) {
    return NextResponse.json(
      { error: 'Función no incluida en tu plan. Actualiza en Facturación.' },
      { status: 403 },
    )
  }
  return null
}

export async function assertUserLimit(
  supabase: SupabaseClient,
  companyId: string,
  role: string,
): Promise<NextResponse | null> {
  if (role === 'super_admin') return null

  const usage = await getCompanyUsage(supabase, companyId)
  if (usage?.at_user_limit) {
    return NextResponse.json(
      { error: 'Alcanzaste el límite de usuarios de tu plan.' },
      { status: 402 },
    )
  }
  return null
}

export async function assertMobileDeviceLimit(
  supabase: SupabaseClient,
  companyId: string,
  role: string,
): Promise<NextResponse | null> {
  if (role === 'super_admin') return null

  const mobileGate = await assertPlanFeature(supabase, companyId, role, 'mobile_app')
  if (mobileGate) return mobileGate

  const usage = await getCompanyUsage(supabase, companyId)
  if (usage?.at_mobile_limit) {
    const max = usage.mobile_devices?.max ?? 0
    const current = usage.mobile_devices?.current ?? 0
    return NextResponse.json(
      {
        error: `Alcanzaste el límite de dispositivos móviles (${current}/${max}). Activa el add-on móvil o actualiza tu plan.`,
      },
      { status: 402 },
    )
  }
  return null
}

export async function assertHardwareDeviceLimit(
  supabase: SupabaseClient,
  companyId: string,
  role: string,
): Promise<NextResponse | null> {
  if (role === 'super_admin') return null

  const usage = await getCompanyUsage(supabase, companyId)
  const maxVehicles = usage?.vehicles?.max ?? 0
  const features = usage?.features

  if (maxVehicles === 0 && features?.hardware_gps !== true) {
    return NextResponse.json(
      { error: 'Tu plan es solo móvil. Para GPS en vehículo actualiza a un plan de flota.' },
      { status: 403 },
    )
  }

  if (usage?.at_vehicle_limit) {
    return NextResponse.json(
      { error: 'Alcanzaste el límite de vehículos GPS de tu plan.' },
      { status: 402 },
    )
  }
  return null
}
