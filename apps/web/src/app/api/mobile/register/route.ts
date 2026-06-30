import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth/get-api-user'
import { MobileRegisterSchema } from '@/lib/mobile/schemas'
import { registerOrUpdateMobileDevice } from '@/lib/mobile/device-registry'
import { assertPlanFeature, assertMobileDeviceLimit } from '@/lib/billing/plan-guard'
import { resolveMobileCompanyId, mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function POST(request: NextRequest) {
  const auth = await getApiUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, supabase } = auth
  const service = createSupabaseServiceClient()

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
  }

  let companyId: string
  try {
    companyId = await resolveMobileCompanyId(profile, service)
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const planGate = await assertPlanFeature(supabase, companyId, profile.role, 'mobile_app')
  if (planGate) return planGate

  const mobileLimit = await assertMobileDeviceLimit(supabase, companyId, profile.role)
  if (mobileLimit) return mobileLimit

  const body = await request.json()
  const parsed = MobileRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const result = await registerOrUpdateMobileDevice(service, {
      companyId,
      userId: user.id,
      deviceUid: parsed.data.device_uid,
      platform: parsed.data.platform,
      brand: parsed.data.brand,
      model: parsed.data.model,
      osVersion: parsed.data.os_version,
      appVersion: parsed.data.app_version,
      pushToken: parsed.data.push_token,
      permissions: parsed.data.permissions,
    })

    if (parsed.data.push_token) {
      await service.from('push_tokens').upsert({
        user_id: user.id,
        company_id: companyId,
        token: parsed.data.push_token,
        platform: 'expo',
        device_info: { platform: parsed.data.platform, device_uid: parsed.data.device_uid },
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,token' })
    }

    return NextResponse.json({
      data: {
        ...result,
        user_name: profile.full_name,
        tracking_intervals: [5, 10, 30, 60, 300],
        company_id: companyId,
      },
    }, { status: result.is_new ? 201 : 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al registrar dispositivo' },
      { status: 500 },
    )
  }
}
