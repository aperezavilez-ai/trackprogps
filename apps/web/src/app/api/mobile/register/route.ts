import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth/get-api-user'
import { MobileRegisterSchema } from '@/lib/mobile/schemas'
import { registerOrUpdateMobileDevice } from '@/lib/mobile/device-registry'

export async function POST(request: NextRequest) {
  const auth = await getApiUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, supabase } = auth

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = MobileRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const service = createSupabaseServiceClient()

  try {
    const result = await registerOrUpdateMobileDevice(service, {
      companyId: profile.company_id,
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
        company_id: profile.company_id,
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
      },
    }, { status: result.is_new ? 201 : 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al registrar dispositivo' },
      { status: 500 },
    )
  }
}
